import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import fs from 'fs';
import { log, configFile } from '../main.js';

type IConfig = {
    key: string;
    discount?: number;
    undercut?: number;
    processWithoutPaymentLimit?: number;
    serveResultsWithoutPaymentLimit?: number;
}

export function getConfig(): IConfig {
    let config: IConfig;

    if (fs.existsSync(configFile)) {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }

    if (!config) {
        log('Generating new config')
        config = {
            key: NDKPrivateKeySigner.generate().privateKey,
        };

        const signer = NDKPrivateKeySigner.generate();
        config.key = signer.privateKey;

        saveConfig(config);
    }

    return config;
}

export function saveConfig(config: IConfig) {
    fs.writeFileSync(configFile, JSON.stringify(config));
}
