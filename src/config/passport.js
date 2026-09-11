const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../utils/prisma');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Look up by googleId first, then fall back to email (account linking)
        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId }, { email }] },
        });

        if (!user) {
          // New user — create with role USER
          user = await prisma.user.create({
            data: {
              name: profile.displayName,
              email,
              googleId,
              role: 'USER',
            },
          });
        } else if (!user.googleId) {
          // Existing email account — link Google ID to it
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Minimal session serialization — used only for the OAuth handshake round-trip.
// After the callback sets the JWT cookie, the session is destroyed.
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
