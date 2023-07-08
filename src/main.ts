import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import debug from 'debug';
import { onNewSummarizationJob } from './job-types/summarization.js';
import { complete, speechToTextJob } from './job-types/speech-to-text.js';
import getSigner from './local-signer.js';
import { requirePayment, validateJobRequest } from './validations/index.js';
import { inProgress } from './jobs/reactions/in-progress.js';
import { publishStatus } from './jobs/reactions/status.js';
import { priceJob } from './jobs/price.js';
import { getConfig } from './config/index.js';
import { decode } from "light-bolt11-decoder";
import { checkInvoiceStatus } from './utils/lnbits.js';

export const log = debug('fool-me-once-dvm');

export const configFile = process.argv[2] || `${process.env.HOME}/.fool-me-once.json`;

log('configFile', {configFile});

export const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.f7z.io'
    ],
    signer: getSigner(),
})
await ndk.connect(2000);
log('connected')

const subs = ndk.subscribe({
    kinds: [68001],
    since: Math.floor(Date.now() / 1000),
    "#j": ["summarize", "explain"],
}, { closeOnEose: false })

const speechToTextSub = ndk.subscribe({
    kinds: [68001],
    since: Math.floor(Date.now() / 1000),
    "#j": ["speech-to-text"],
}, { closeOnEose: false })

subs.on("event", (e) => processJobEvent(e, 'summarize'));
speechToTextSub.on("event", (e) => processJobEvent(e, 'speech-to-text'));

type JobType = "summarize" | "explain" | "speech-to-text";

async function processJobEvent(event: NDKEvent, type: JobType): Promise<void> {
    const config = getConfig();
    let jobAmount = await priceJob(event);
    let output: any;
    let payReqEvent: NDKEvent;
    let paidAmount = 0;

    const waitForPaymentBeforeProcessing = (): boolean => {
        const processWithoutPaymentLimit = config.processWithoutPaymentLimit ?? 500;
        log('waitForPaymentBeforeProcessing', {jobAmount, processWithoutPaymentLimit});
        return jobAmount && jobAmount > (processWithoutPaymentLimit * 1000);
    }

    const waitForPaymentBeforePublishingResult = (): boolean => {
        const serveResultsWithoutPaymentLimit = config.serveResultsWithoutPaymentLimit ?? 1000;
        log('waitForPaymentBeforeProcessing', {jobAmount});
        return jobAmount && jobAmount > (serveResultsWithoutPaymentLimit * 1000);
    }

    const missingAmount = (): number => jobAmount - paidAmount;

    const reqPayment = async (): Promise<void> => {
        payReqEvent = await requirePayment(event, missingAmount(), true);

        if (config.undercut) {
            startUndercutting();
        }
    }

    const startUndercutting = async (): Promise<void> => {
        const undercutSub = ndk.subscribe({
            kinds: [68002, 68003],
            ...event.filter()
        }, { closeOnEose: false, groupable: false });
        undercutSub.on("event", async (e) => {
            if (e.pubkey === payReqEvent.pubkey) return;

            // check if this is a payment request
            const amountValue = e.tagValue('amount');
            if (!amountValue) return;

            log(`found someone else's bid`, amountValue);

            // check if it's more-or-less than the current bid
            const amount = parseInt(amountValue);
            if (amount > jobAmount) return;

            // if so, undercut
            jobAmount = Math.round(amount * config.undercut);
            log(`undercutting to ${jobAmount}`);
            setTimeout(async () => {
                payReqEvent = await requirePayment(event, jobAmount, true);
            }, 5000);
        });
    }

    const waitForPaymentViaZap = (payReqEvent, resolve, reject) => {
        const zapmon = ndk.subscribe({
            kinds: [68002, 9735],
            ...payReqEvent.filter()
        }, { closeOnEose: false });
        zapmon.on("event", (e) => {
            log(`received a ${e.kind} for the payment request`, e.rawEvent());

            // TODO: validate amount, zapper, etc
            if (e.kind === 9735) {
                // TODO: This needs to check the actual zap
                paidAmount = jobAmount;

                // zapmon.close();
                resolve();
            } else if (e.kind === 68003) {
                zapmon.close();
                reject();
            }
        });
    }

    const waitForPaymentViaLNInvoice = (payReqEvent, resolve) => {
        const amountTag = payReqEvent.getMatchingTags('amount')[0];
        const bolt11 = amountTag[2];

        if (!bolt11) return;

        const invoice = decode(bolt11);
        const pr = invoice.payment_hash;
        log({invoice});
        log({pr});

        const checkInterval = setInterval(() => {
            checkInvoiceStatus(invoice).then((status) => {
                if (status.paid) {
                    log('invoice paid');
                    paidAmount = jobAmount;
                    clearInterval(checkInterval);
                    resolve();
                }
            })
        }, 2000);
    }

    const waitForPayment = async (payReqEvent: NDKEvent): Promise<void> => {
        log('waitForPayment');
        const promise = new Promise<void>((resolve, reject) => {
            waitForPaymentViaZap(payReqEvent, resolve, reject)
            waitForPaymentViaLNInvoice(payReqEvent, resolve)
        });

        return promise;
    }

    const startProcessing = async () => {
        log('startProcessing');
        inProgress(event);

        switch (type) {
            case "summarize": {
                output = await onNewSummarizationJob(event);
                break;
            }
            case "speech-to-text": {
                output = await speechToTextJob(event);
                break;
            }
        }
    }

    const publishResult = (): void => {
        log('publishResult');
        complete(event, missingAmount(), { output });
    }

    await validateJobRequest(event);

    if (jobAmount > paidAmount && waitForPaymentBeforeProcessing()) {
        await reqPayment();
        await waitForPayment(payReqEvent);
    }

    await startProcessing();

    await publishStatus(event, 'finished');

    if (jobAmount > paidAmount && waitForPaymentBeforePublishingResult()) {
        await reqPayment();
        await waitForPayment(payReqEvent);
        log(`done with wait for publish`)
    }

    await publishResult();
}