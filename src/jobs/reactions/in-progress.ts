import { NDKEvent } from '@nostr-dev-kit/ndk';
import { log, ndk } from '../../main.js';

export async function inProgress(event: NDKEvent): Promise<NDKEvent> {
    log("marking job as in progress");

    const reactEvent = new NDKEvent(ndk, {
        kind: 68003,
        content: "👍",
        tags: [
            [ "status", "started" ],
        ]
    })

    reactEvent.tag(event, "job");
    await reactEvent.sign();
    await reactEvent.publish();
    return reactEvent;
}
