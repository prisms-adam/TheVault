const SCHOOL_DOMAIN = 'prismsus.org';

const identitySelect = {
  id: true,
  username: true,
  isAdmin: true,
  displayName: true,
  email: true,
  googleSub: true,
};

const authenticatedUserSelect = { ...identitySelect };
const publicAuthorSelect = { ...identitySelect };

function hasVerifiedSchoolIdentity(user) {
  if (!user?.googleSub || typeof user.email !== 'string') return false;
  const email = user.email.trim().toLowerCase();
  const parts = email.split('@');
  return parts.length === 2 && Boolean(parts[0]) && parts[1] === SCHOOL_DOMAIN;
}

function toAuthenticatedUser(user) {
  const isSchoolAccount = hasVerifiedSchoolIdentity(user);
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    displayName: user.displayName || null,
    email: isSchoolAccount ? user.email.toLowerCase() : null,
    isSchoolAccount,
  };
}

function toPublicAuthor(user) {
  const authenticated = toAuthenticatedUser(user);
  return {
    username: authenticated.username,
    displayName: authenticated.displayName,
    email: authenticated.email,
    isSchoolAccount: authenticated.isSchoolAccount,
  };
}

module.exports = {
  SCHOOL_DOMAIN,
  authenticatedUserSelect,
  publicAuthorSelect,
  toAuthenticatedUser,
  toPublicAuthor,
};
