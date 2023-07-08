import { NDKTag } from '@nostr-dev-kit/ndk';
import axios from 'axios';
import fs from 'fs';

export async function fetchFileFromInput(input: NDKTag): Promise<string> {
    switch (input[2]) {
        case 'url': {
            const url = input[1];
            const fileExtension = url.split('.').pop();

            // download the file
            // save it to the local filesystem
            // return the path to the file
            const response = await axios.get(url, {
                responseType: 'stream'
            });

            const randomName = Math.random().toString(36).substring(7);
            const path = `./${randomName}.${fileExtension}`;

            await response.data.pipe(fs.createWriteStream(path));

            return path;
        }
    }

    return undefined;
}