import fs from 'fs';
import path from 'path';
import { parse } from 'subtitle';
import detectCharacterEncoding from 'detect-character-encoding';

const encodingTable = {
  "ISO-8859-1": "latin1",
  "UTF-8": "utf8"
};

// Finding all files in a folder recursively (including subdirectories)
var walk = function (dir, done) {
  var results = [];
  fs.readdir(dir, function (err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function (file) {
      file = path.resolve(dir, file);
      fs.stat(file, function (err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function (err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

walk("./", function (err, files) {
  if (err) {
    console.log("File cannot be properly processed for the following reason:", err);

  } else {
    const srtFiles = files.filter(el => path.extname(el).toLowerCase() === ".srt");

    // Do forEach cause srtFiles is an Array!
    srtFiles.forEach((srtFile) => {
      const outputFileName = srtFile.replace(/srt$/, "txt");

      // Encoding
      const fileBuffer = fs.readFileSync(srtFile);
      const fileEncoding = detectCharacterEncoding(fileBuffer);

      if (!encodingTable[fileEncoding.encoding]) {
        console.log("Unknown file encoding!");
        return null;
      }

      let subtitleText = "";
      let index = 0;

      fs.createReadStream(srtFile, encodingTable[fileEncoding.encoding])
        .pipe(parse())
        .on('data', (node) => {
          if (node.type === 'cue') {
            const elem = node.data;
            const text = elem.text.replace(/\<\/*.*?\>/g, "").replace(/\n/g, " ");
            index++;

            if (text) {
              if (index % 20) {
                subtitleText += `${text} `;

              } else {
                subtitleText += `${text}\n`;
              }
            }
          }
        })
        .on('finish', () => {
          const foramttedText = subtitleText.replace(/\s\s/g, " ");
          fs.writeFileSync(outputFileName, foramttedText);
        });
    });
  }
});

