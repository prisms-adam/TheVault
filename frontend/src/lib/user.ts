export interface UserIdentity {
  id: string;
  username: string;
  isAdmin: boolean;
  displayName: string | null;
  email: string | null;
  isSchoolAccount: boolean;
}

export type ContentAuthor = Pick<
  UserIdentity,
  'username' | 'displayName' | 'email' | 'isSchoolAccount'
>;

export function getUserDisplayName(user: ContentAuthor) {
  return user.isSchoolAccount && user.displayName
    ? user.displayName
    : user.username;
}
