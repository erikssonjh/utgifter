// server.js - Backend server för utgifterare
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const Papa = require('papaparse');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer konfiguration för filuppladdning
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Endast CSV-filer är tillåtna'), false);
        }
    }
});

// Databas-setup
const dbPath = process.env.NODE_ENV === 'production' ? '/home/data/transactions.db' : './transactions.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Fel vid anslutning till databas:', err);
    } else {
        console.log('Ansluten till SQLite-databas');
        initDatabase();
    }
});

// Skapa tabeller
function initDatabase() {
    const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            account TEXT NOT NULL,
            type TEXT NOT NULL,
            saldo REAL,
            currency TEXT DEFAULT 'SEK',
            avsändare TEXT,
            mottagare TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createAccountsTable = `
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account);
        CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
    `;

    db.exec(createTransactionsTable + createAccountsTable + createIndexes, (err) => {
        if (err) {
            console.error('Fel vid skapande av tabeller:', err);
        } else {
            console.log('Databastabeller skapade/verifierade');
        }
    });
}

// Hjälpfunktioner
function parseSwedishNumber(value) {
    if (!value) return 0;
    // Konvertera till string och ersätt komma med punkt
    const stringValue = String(value).trim();
    const normalizedValue = stringValue.replace(',', '.');
    return parseFloat(normalizedValue) || 0;
}

function normalizeTransaction(transaction, account, fileType) {
    if (fileType === 'simple') {
        // Format för 25.csv
        return {
            date: transaction.Datum,
            description: (transaction.Beskrivning || '').trim(),
            amount: parseSwedishNumber(transaction.Summa),
            account: account,
            type: fileType,
            saldo: null,
            currency: 'SEK',
            avsändare: null,
            mottagare: null
        };
    } else {
        // Format för bank-CSV (checkkonto/personkonto)
        const amount = parseSwedishNumber(transaction.Belopp);
        const saldo = parseSwedishNumber(transaction.Saldo);
        
        return {
            date: transaction.Bokföringsdag,
            description: (transaction.Rubrik || '').trim(),
            amount: amount,
            account: account,
            type: fileType,
            saldo: saldo,
            currency: transaction.Valuta || 'SEK',
            avsändare: transaction.Avsändare || null,
            mottagare: transaction.Mottagare || null
        };
    }
}

function parseCSV(content, fileName) {
    return new Promise((resolve, reject) => {
        Papa.parse(content, {
            header: true,
            delimiter: ';',
            skipEmptyLines: true,
            delimitersToGuess: [';', ',', '\t'],  // Testa olika avgränsare automatiskt
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(new Error(`Parse fel: ${results.errors[0].message}`));
                    return;
                }

                try {
                    // Bestäm filtyp och kontonamn
                    let fileType, account;
                    
                    if (fileName.includes('CHECKKONTO')) {
                        fileType = 'checkkonto';
                        account = 'Checkkonto';
                    } else if (fileName.includes('PERSONKONTO')) {
                        fileType = 'personkonto';
                        account = 'Personkonto';
                    } else {
                        fileType = 'simple';
                        account = 'Kort';
                    }

                    // Normalisera alla transaktioner
                    const normalizedTransactions = results.data
                        .filter(row => row.Datum || row.Bokföringsdag)
                        .map(row => normalizeTransaction(row, account, fileType));

                    resolve(normalizedTransactions);
                } catch (err) {
                    reject(new Error(`Fel vid normalisering: ${err.message}`));
                }
            },
            error: (error) => {
                reject(new Error(`CSV parse fel: ${error.message}`));
            }
        });
    });
}

// API Routes

// Hälsokontroll
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Hämta alla transaktioner med filter
app.get('/api/transactions', (req, res) => {
    const { account, fromDate, toDate, search, limit = 1000, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (account && account !== 'alla') {
        query += ' AND account = ?';
        params.push(account);
    }

    if (fromDate) {
        query += ' AND date >= ?';
        params.push(fromDate);
    }

    if (toDate) {
        query += ' AND date <= ?';
        params.push(toDate);
    }

    if (search) {
        query += ' AND description LIKE ?';
        params.push(`%${search}%`);
    }

    query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Databasfel:', err);
            res.status(500).json({ error: 'Fel vid hämtning av transaktioner' });
        } else {
            res.json(rows);
        }
    });
});

// Hämta konton
app.get('/api/accounts', (req, res) => {
    const query = 'SELECT DISTINCT account FROM transactions ORDER BY account';
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Databasfel:', err);
            res.status(500).json({ error: 'Fel vid hämtning av konton' });
        } else {
            const accounts = rows.map(row => row.account);
            res.json(accounts);
        }
    });
});

// Hämta statistik
app.get('/api/stats', (req, res) => {
    const { account, fromDate, toDate, type = 'all' } = req.query;
    
    let query = 'SELECT account, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income, ' +
                'SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses, ' +
                'COUNT(*) as transaction_count FROM transactions WHERE 1=1';
    const params = [];

    if (account && account !== 'alla') {
        query += ' AND account = ?';
        params.push(account);
    }

    if (fromDate) {
        query += ' AND date >= ?';
        params.push(fromDate);
    }

    if (toDate) {
        query += ' AND date <= ?';
        params.push(toDate);
    }

    if (type === 'monthly') {
        query += ' GROUP BY strftime("%Y-%m", date) ORDER BY date DESC';
    } else if (type === 'yearly') {
        query += ' GROUP BY strftime("%Y", date) ORDER BY date DESC';
    } else {
        query += ' GROUP BY account';
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Databasfel:', err);
            res.status(500).json({ error: 'Fel vid hämtning av statistik' });
        } else {
            const stats = rows.map(row => ({
                ...row,
                net: row.income - row.expenses
            }));
            res.json(stats);
        }
    });
});

// Månadsstatistik
app.get('/api/stats/monthly/:year', (req, res) => {
    const year = req.params.year;
    const query = `
        SELECT 
            strftime('%m', date) as month,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
            COUNT(*) as transaction_count
        FROM transactions 
        WHERE strftime('%Y', date) = ?
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month
    `;

    db.all(query, [year], (err, rows) => {
        if (err) {
            console.error('Databasfel:', err);
            res.status(500).json({ error: 'Fel vid hämtning av månadsstatistik' });
        } else {
            const monthNames = [
                'januari', 'februari', 'mars', 'april', 'maj', 'juni',
                'juli', 'augusti', 'september', 'oktober', 'november', 'december'
            ];

            const stats = rows.map(row => ({
                month: parseInt(row.month),
                monthName: monthNames[parseInt(row.month) - 1],
                income: row.income,
                expenses: row.expenses,
                net: row.income - row.expenses,
                transactionCount: row.transaction_count
            }));

            res.json(stats);
        }
    });
});

// Importera CSV-filer
app.post('/api/import', upload.array('csvFiles'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Inga filer uppladdade' });
    }

    try {
        let totalImported = 0;
        const results = [];

        for (const file of req.files) {
            const content = fs.readFileSync(file.path, 'utf8');
            const transactions = await parseCSV(content, file.originalname);

            // Sätt in transaktioner i databas
            const insertPromises = transactions.map(transaction => {
                return new Promise((resolve, reject) => {
                    const query = `
                        INSERT INTO transactions 
                        (date, description, amount, account, type, saldo, currency, avsändare, mottagare)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.run(query, [
                        transaction.date,
                        transaction.description,
                        transaction.amount,
                        transaction.account,
                        transaction.type,
                        transaction.saldo,
                        transaction.currency,
                        transaction.avsändare,
                        transaction.mottagare
                    ], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.lastID);
                        }
                    });
                });
            });

            await Promise.all(insertPromises);
            
            results.push({
                fileName: file.originalname,
                transactionCount: transactions.length
            });
            
            totalImported += transactions.length;

            // Rensa temporär fil
            fs.unlinkSync(file.path);
        }

        res.json({
            success: true,
            totalImported,
            files: results
        });

    } catch (error) {
        console.error('Import fel:', error);
        
        // Rensa temporära filer vid fel
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });

        res.status(500).json({ error: error.message });
    }
});

// Ta bort alla transaktioner (för utveckling)
app.delete('/api/transactions', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Inte tillåtet i produktion' });
    }

    db.run('DELETE FROM transactions', [], function(err) {
        if (err) {
            console.error('Databasfel:', err);
            res.status(500).json({ error: 'Fel vid rensning av databas' });
        } else {
            res.json({ 
                success: true, 
                deletedRows: this.changes 
            });
        }
    });
});

// Serve frontend i produktion
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

// Felhantering
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Filuppladdningsfel: ' + error.message });
    }
    
    console.error('Serverfel:', error);
    res.status(500).json({ error: 'Internt serverfel' });
});

// 404 hantering
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint hittades inte' });
});

// Starta server
app.listen(PORT, () => {
    console.log(`Server körs på port ${PORT}`);
    console.log(`Miljö: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Stänger ner server...');
    db.close((err) => {
        if (err) {
            console.error('Fel vid stängning av databas:', err);
        } else {
            console.log('Databas stängd');
        }
        process.exit(0);
    });
});

module.exports = app;