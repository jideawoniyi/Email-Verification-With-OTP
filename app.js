const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const app = express();

const dotenv = require('dotenv');
dotenv.config();
app.use(express.static("public"));
// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the view directory to the default "views" directory
app.set('views', './views');

app.engine("ejs", require("ejs").renderFile);
const port = 5000;


// Enable the app to parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));


const sessionSecret = process.env.SESSION_SECRET;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const mongodbUri = process.env.MONGODB_URI;

// Set up session management using the express-session package
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true
}));

// Connect to the MongoDB database
mongoose.set('strictQuery', true);
mongoose.connect(mongodbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


// Replace YOUR_ACCOUNT_SID and YOUR_AUTH_TOKEN with your Twilio account SID and auth token, respectively
const client = new twilio(twilioAccountSid, twilioAuthToken);

// Replace YOUR_TWILIO_PHONE_NUMBER with your Twilio phone number
const fromPhoneNumber = twilioPhoneNumber;


// Set up the form submission route
const User = require('./models/user');

app.get('/register', (req, res) => {
    // Render a form that allows the user to enter their registration information
    res.render('registration');
  });


  app.post('/register', (req, res) => {
    // Retrieve the form data from the request body
    const { username, email, phoneNumber, address, password } = req.body;
  
    // Hash the password using bcrypt
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.log(err);
        res.send('There was an error hashing the password.');
      } else {
        // Check if a user with the same username already exists
        User.findOne({ username: username }, (error, user) => {
          if (error) {
            console.log(error);
            res.render('error', {error:'There was an error checking for the existence of a user with the same username.'});
          } else if (user) {
            console.log('A user with the same username already exists.');
            res.render('error', { error: 'A user with the same username already exists.' });
          } else {
            // Create a new user document
            const newUser = new User({
              username: username,
              email: email,
              phoneNumber: phoneNumber,
              address: address,
              password: hashedPassword
            });
        
            // Save the new user document to the database
            newUser.save((error, user) => {
              if (error) {
            
                const errorMessage = error.toString();
                const emailMatch = errorMessage.match(/email_1 dup key/);
                const phoneMatch = errorMessage.match(/phoneNumber_1 dup key/);

                if (emailMatch) {
                  res.render('error', { error: "Email already exists, please use another one" });
                }
                else if(phoneMatch){
                  res.render('error', { error: "Phone number already exists, please use another one" });
                }else{
                  res.render('error', { error: error });
                }

                // const emailMatch = errorMessage.match(/{ email: "([^"]+)" }/);
                // if (emailMatch) {
                //   const email = emailMatch[1];  
                //   res.render('error', { error: error });
                // }

              } else {
                console.log('New user saved successfully.');
                // Define the email options, including the email subject, recipient, and body
                

// Create the mailOptions object
const mailOptions = {
  from: 'dcarbonizer@gmail.com',
  to: email,
  subject: 'Verify your email address',
  headers: {
    'Content-Type': 'text/html'
  },
  html: `
  <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
          }
          p {
            background-color: black;
            color: white;
            font-family: 'Helvetica Neue', sans-serif;
            font-size: 16px;
            padding: 20px;
            text-align: center;
          }
          a {
            color: white;
            background-color: green;
            border: none;
            border-radius: 5px;
            display: block;
            margin: 0 auto;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
          }
          img{
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <img src="logo.png" alt="yycme logo" width="80" height="80">
        <p>Thank you for registering! Please click the following link to verify your email address:</p>
        <p><a href="http://localhost:${port}/send-otp?phoneNumber=${phoneNumber}">Verify Email</a></p>
      </body>
    </html>
  `
};

// Set up the email transport using the email account you set up earlier
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'dcarbonizer@gmail.com',
      pass: 'uijapsywjzmofrjg'
    }
  });

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
    res.render('emailresponse');
  }
});

              }
            });
          }
        });
      }
    });
  });
     
  

// Set up the OTP route
app.get('/send-otp', (req, res) => {
  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // Store the OTP in the session
  req.session.otp = otp;

  // Retrieve the phone number from the query string
  const phoneNumber = req.query.phoneNumber;

  // Send the OTP via SMS using the Twilio client
  client.messages
    .create({
      body: 'Your OTP is: ' + otp,
      from: fromPhoneNumber,
      to: phoneNumber
    })
    .then(() => {
      // Render the verify-otp.ejs view with the OTP and phone number
  
      res.render('verify-otp', { otp, phoneNumber });
    })
    .catch(error => {
      console.log(error);
      res.send('There was an error sending the OTP.');
    });
});

// Set up the OTP verification route
app.post('/verify-otp', (req, res) => {
  // Retrieve the OTP and phone number from the request body
  const { otp, phoneNumber } = req.body;
  console.log(`The otp stored in session is: ${req.session.otp} and the otp you entered is ${otp}`);
  // Check if the entered OTP is correct
  if (otp === req.session.otp) {
    // OTP is correct, redirect to the welcome page
    res.render('welcome');
  } else {
    // OTP is incorrect, render the verify-otp.ejs view with an error message
      res.render('verify-otp', {
      message: 'Incorrect OTP. Please try again.',
      phoneNumber
    });
  }
});

// Set up the welcome page route
app.get('/welcome', (req, res) => {
  res.render('welcome');
});

// Start the server on the specified port

app.listen(port, () => {
  console.log(`Server listening on port ${port}...`);
});
