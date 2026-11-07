const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

function configurePassport() {
  // Use passport-local with custom lookup supporting both username and email
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password'
      },
      async (usernameOrEmail, password, done) => {
        try {
          const identifier = usernameOrEmail.trim().toLowerCase();
          // Find user by either username or email
          const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier }]
          });

          if (!user) {
            return done(null, false, { message: 'Incorrect username/email or password.' });
          }

          if (user.status === 'SUSPENDED') {
            return done(null, false, { message: 'This account has been suspended. Please contact the administrator.' });
          }

          // Use passport-local-mongoose's authenticate method
          user.authenticate(password, (err, authenticatedUser, passwordErr) => {
            if (err) return done(err);
            if (!authenticatedUser) {
              return done(null, false, { message: passwordErr?.message || 'Incorrect username/email or password.' });
            }

            // Update last login
            authenticatedUser.lastLoginAt = new Date();
            authenticatedUser.save().catch(() => {});

            return done(null, authenticatedUser);
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());
}

module.exports = configurePassport;

