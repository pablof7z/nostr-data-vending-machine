import { NDKEvent } from '@nostr-dev-kit/ndk';
import { validateJobRequest } from '../validations/index.js';
import { inProgress } from '../jobs/reactions/in-progress.js';

export async function onNewSummarizationJob(event: NDKEvent): Promise<void> {
    console.log("New summarization job");

    await validateJobRequest(event);

    inProgress(event);
}
