// Switches for work that is built but not part of the current scope.
// The client progress portal stays off until the CLIENT_PORTAL variable is set to "on".
export const clientPortalOn = (env) => env.CLIENT_PORTAL === 'on';
