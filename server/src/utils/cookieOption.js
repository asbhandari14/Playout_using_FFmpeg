
const isProduction = process.env.NODE_ENV === 'production';
const getCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/'
});

export default getCookieOptions;