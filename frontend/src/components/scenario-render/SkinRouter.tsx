import { ChatSkin } from './ChatSkin';
import { EmailSkin } from './EmailSkin';
import { SocialFeedSkin } from './SocialFeedSkin';
import type { SkinRouterProps } from './types';
export function SkinRouter({ renderSkin, ...props }: SkinRouterProps) {
  if (renderSkin === 'email') return <EmailSkin {...props} />;
  if (renderSkin === 'social_feed') return <SocialFeedSkin {...props} />;
  return <ChatSkin {...props} />;
}
