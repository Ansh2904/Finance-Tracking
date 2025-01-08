const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(
  session({
    secret: '1029',
    resave: false,
    saveUninitialized: true
  })
);

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Anshu1029m@n',
  database: 'personal_finance'
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

app.get('/', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/home', (req, res) => res.render('home'));

app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  const sql = 'INSERT INTO users (username,email, password) VALUES (?, ?,?)';
  db.query(sql, [username, email, password], (err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(sql, [username, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      req.session.userId = results[0].id;
      res.redirect('/home');
    } else {
      res.render('login', { error: 'Invalid username or password' });
    }
  });
});

app.get('/transactions', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC';
  db.query(sql, [req.session.userId], (err, results) => {
    if (err) throw err;
    res.render('transactions', { transactions: results });
  });
});

app.post('/transactions', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const { description, amount, type } = req.body;
  const date = new Date().toISOString().slice(0, 10);

  const sql =
    'INSERT INTO transactions (date, description, amount, type, user_id) VALUES (?, ?, ?, ?, ?)';
  db.query(
    sql,
    [date, description, parseFloat(amount), type, req.session.userId],
    (err) => {
      if (err) throw err;
      res.redirect('/transactions');
    }
  );
});

app.post('/budget', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const userId = req.session.userId;
  const { amount } = req.body;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const insertOrUpdateQuery = `
      INSERT INTO budgets (user_id, amount, month_year) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE amount = VALUES(amount);
    `;

  db.query(insertOrUpdateQuery, [userId, parseFloat(amount), currentMonth], (err) => {
    if (err) throw err;
    res.redirect('/budget');
  });
});

app.get('/budget', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const userId = req.session.userId;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const budgetQuery = `
      SELECT amount FROM budgets WHERE user_id = ? AND month_year = ?;
    `;
  const expensesQuery = `
      SELECT SUM(amount) AS total_expenses 
      FROM transactions 
      WHERE user_id = ? AND type = 'Expense' AND DATE_FORMAT(date, '%Y-%m') = ?;
    `;

  db.query(budgetQuery, [userId, currentMonth], (err, budgetResults) => {
    if (err) throw err;

    const budget = budgetResults[0] ? budgetResults[0].amount : 0;

    db.query(expensesQuery, [userId, currentMonth], (err, expenseResults) => {
      if (err) throw err;

      const totalExpenses = expenseResults[0].total_expenses || 0;
      const remainingBudget = budget - totalExpenses;

      res.render('budget', {
        budget,
        totalExpenses,
        remainingBudget,
        error: null
      });
    });
  });
});

app.get('/goals', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const sql = 'SELECT * FROM goals WHERE user_id = ? ORDER BY deadline';
  db.query(sql, [req.session.userId], (err, results) => {
    if (err) throw err;

    res.render('goals', { goals: results });
  });
});

app.post('/goals', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const { title, target_amount, deadline } = req.body;
  const sql = `
      INSERT INTO goals (user_id, title, target_amount, deadline) 
      VALUES (?, ?, ?, ?)
    `;

  db.query(
    sql,
    [req.session.userId, title, parseFloat(target_amount), deadline],
    (err) => {
      if (err) throw err;
      res.redirect('/goals');
    }
  );
});

app.post('/goals/:id/progress', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  const { saved_amount } = req.body;
  const goalId = req.params.id;
  const userId = req.session.userId;

  const updateSavedAmountSql = `
      UPDATE goals
      SET saved_amount = saved_amount + ?
      WHERE id = ? AND user_id = ?
    `;

  db.query(updateSavedAmountSql, [parseFloat(saved_amount), goalId, userId], (err) => {
    if (err) throw err;

    const checkCompletionSql = `
        UPDATE goals
        SET completed = (saved_amount >= target_amount)
        WHERE id = ? AND user_id = ?
      `;

    db.query(checkCompletionSql, [goalId, userId], (err) => {
      if (err) throw err;
      res.redirect('/goals');
    });
  });
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
