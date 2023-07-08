import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { getConfig } from './config/index.js';

export default function getSigner(): NDKPrivateKeySigner {
    const config = getConfig();

    return new NDKPrivateKeySigner(config.key!);
}