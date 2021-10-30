import fs from 'fs';
import os from 'os';
import path from 'path';
import { parse, map, filter } from 'subtitle';
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

      let previousEnd = 0;

      fs.createReadStream(fileName, encodingTable[fileEncoding])
        .pipe(parse())
        .pipe(map((node) => {
          if (node.type === 'cue') {
            const silenceStart = previousEnd;
            const elem = node.data;
            const text = elem.text.replace(/\<\/*.*?\>/g, "");

            const sentenceEnd = numberConverter(elem.end);
            const sentenceStart = numberConverter(elem.start);

            // Spot music, other sounds, and silence
            const music = /♪|\[.+\]/.test(text);   // The automated subtitles on Youtube use [Music] to indicate music and [Applause] and so on.
            const includesWords = /\w/.test(text);

            // If it's music or doesn't include any words
            if (music || !includesWords) {
              return null;

              // If it's text and the silence gap is bigger than 2 seconds
            } else if (sentenceStart - silenceStart > 2) {
              previousEnd = sentenceEnd;
              return `${silenceStart + space}\t\t${sentenceStart - space}\t\tSilence\n`;

              // If it's text and the silence gap is smaller or equal to 2 seconds
            } else if (sentenceStart - silenceStart <= 2) {
              previousEnd = sentenceEnd;
              return null;

            } else {
              return null;
            }
          }
        }))
        .pipe(filter(elem => elem))
        .pipe(fs.createWriteStream(`${downloadDir}/new-audacity-label.txt`, encodingTable[fileEncoding]));

    } else {
      console.log("Conversion failed. Make sure you are in the Downloads folder and there is no more than one srt file present!");
    }
  }
});


function numberConverter(num) {
  num = num.toString();
  return Number(num.slice(0, num.length - 3) + "." + num.slice(num.length - 3));
}
