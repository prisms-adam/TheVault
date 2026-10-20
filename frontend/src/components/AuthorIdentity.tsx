import { BadgeCheck } from 'lucide-react';
import { getUserDisplayName, type ContentAuthor } from '../lib/user';

interface AuthorIdentityProps {
  author: ContentAuthor;
  compact?: boolean;
  className?: string;
}

export default function AuthorIdentity({ author, compact = false, className = '' }: AuthorIdentityProps) {
  const name = getUserDisplayName(author);

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${compact ? '' : 'flex-wrap'} ${className}`}
      data-testid="author-identity"
      data-school-account={author.isSchoolAccount ? 'true' : 'false'}
    >
      <span className={`min-w-0 ${compact ? 'truncate' : 'break-words'}`}>{name}</span>
      {author.isSchoolAccount ? (
        <>
          <BadgeCheck size={compact ? 12 : 14} className="shrink-0 text-sky-400" aria-label="Verified PRISMS account" />
          {author.email && !compact && <span className="min-w-0 break-all normal-case text-slate-500">{author.email}</span>}
        </>
      ) : (
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-500">
          Local
        </span>
      )}
    </span>
  );
}
