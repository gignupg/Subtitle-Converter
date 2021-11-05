import fs from 'fs';
import os from 'os';
import path from 'path';
import { parse, map, filter, formatTimestamp } from 'subtitle';
import detectCharacterEncoding from 'detect-character-encoding';

let space = 0;
const firstArg = process.argv[2];

if (firstArg && !isNaN(firstArg)) {
    space = Number(firstArg);
}

const encodingTable = {
    "ISO-8859-1": "latin1",
    "UTF-8": "utf8"
};

const homedir = os.homedir();

const downloadDir = path.join(homedir, '/Downloads');

fs.readdir(downloadDir, function (err, files) {
    if (err) {
        console.log("File cannot be properly processed for the following reason:", err);

    } else {
        const srtFiles = files.filter(el => path.extname(el).toLowerCase() === ".srt");

        if (srtFiles && srtFiles.length === 1) {
            const fileName = path.join(downloadDir, srtFiles[0]);

            // Encoding
            const fileBuffer = fs.readFileSync(fileName);
            const fileEncoding = detectCharacterEncoding(fileBuffer);

            let count = 0;
            let prevEnd = 0;  // ms

            fs.createReadStream(fileName, encodingTable[fileEncoding])
                .pipe(parse())
                .pipe(map((node) => {
                    if (node.type === 'cue') {
                        const elem = node.data;       // time in ms
                        const start = formatTimestamp(elem.start);   // time in srt format
                        const end = formatTimestamp(elem.end);       // time in srt format
                        const text = elem.text.replace(/\<\/*.*?\>/g, "");
                        const silence = Math.floor((elem.start - prevEnd) / 1000);   // in seconds

                        count++;

                        if (silence >= 10) {
                            let silenceStart = prevEnd;
                            let silenceEnd = prevEnd + 1000;

                            let silenceIndicator = `${count}\n${formatTimestamp(silenceStart)} --> ${formatTimestamp(silenceEnd)}\nSilence (${silence})\n\n`;

                            for (let i = silence - 1; i > 0; i--) {
                                count++;
                                silenceStart += 1000;
                                silenceEnd += 1000;

                                silenceIndicator += `${count}\n${formatTimestamp(silenceStart)} --> ${formatTimestamp(silenceEnd)}\nSilence (${i})\n\n`;
                            }

                            count++;
                            prevEnd = elem.end;

                            return silenceIndicator + `${count}\n${start} --> ${end}\n${text}\n\n`;

                        } else {
                            prevEnd = elem.end;
                            return `${count}\n${start} --> ${end}\n${text}\n\n`;
                        }
                    }
                }))
                .pipe(filter(elem => elem))
                .pipe(fs.createWriteStream(`${downloadDir}/subtitles-with-silence.srt`, encodingTable[fileEncoding]));

        } else {
            console.log("Conversion failed. Make sure you are in the Downloads folder and there is no more than one srt file present!");
        }
    }
});
