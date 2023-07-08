import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
import validateExpiration from './expiration.js';
import validateRequester from './requester.js';
import validateNoRecentResults from './no-recent-results.js';
import { ndk } from '../main.js';
import { addAmount } from '../job-types/speech-to-text.js';

export async function validateJobRequest(event: NDKEvent): Promise<void> {
    await validateExpiration(event);
    await validateRequester(event);
    await validateNoRecentResults(event);
}

export async function requirePayment(event: NDKEvent, amount?: number, publish?: boolean): Promise<NDKEvent> {
    if (!amount) {
        const bidTag = event.tagValue('bid');
        amount = bidTag ? parseInt(bidTag) : undefined;
    }

    if (!amount) {
        throw new Error("No amount specified");
    }

    const payReq = new NDKEvent(ndk, {
        kind: 68003,
        content: "`Please pay for this job`",
        tags: [
            ["status", "payment-required"],
        ]
    } as NostrEvent);
    await addAmount(payReq, amount);
    payReq.tag(event, "job");

    await payReq.sign();
    console.log(payReq.rawEvent());

    if (publish !== false) await payReq.publish();

    return payReq;
}