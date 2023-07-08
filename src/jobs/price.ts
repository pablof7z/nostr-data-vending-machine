import { NDKEvent } from '@nostr-dev-kit/ndk';
import { log } from '../main.js';
import { getConfig } from '../config/index.js';

export async function priceJob(event: NDKEvent): Promise<number> {
    const config = getConfig();
    const bidTag = event.tagValue('bid');
    let bidAmount =  bidTag ? parseInt(bidTag) : 1001 * 1000;

    if (config.discount) {
        bidAmount = bidAmount * config.discount;
    }

    log(`bid amount: ${bidAmount} (${config.discount??'no'} discount)`);

    return bidAmount;
}
