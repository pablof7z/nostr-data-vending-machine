import { NDKEvent } from '@nostr-dev-kit/ndk';
import { ndk } from '../main.js';

export default async function validateNoRecentResults(event: NDKEvent): Promise<void> {
    const results = ndk.fetchEvents({
        kinds: [68002 as number],
        "#e": [event.id],
    }, { groupable: false })

    if (results.length > 0) {
        throw new Error(`This job already has ${results.length} results`);
    }
}