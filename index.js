const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const port = 3003;
const fs = require("fs");
const translatte = require("translatte");

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const srcLang = "en";
const srcPath = `./sourceLanguage/${srcLang}.json`;
const targetLangs = [
  "it",
  "fr",
  "de",
  "nl",
  "es",
  "pt",
  "pl",
  "bg",
  "cs",
  "da",
  "et",
  "el",
  "ga",
  "hr",
  "lv",
  "lt",
  "hu",
  "mt",
  "sk",
  "sl",
  "fi",
  "sv",
  "ro",
  "en",
];

const readJSON = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      }
    });
  });
};

const writeJSON = (path, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(data, null, 2), "utf8", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

async function translateText(text, srcLang, destLang) {
  // Regular expression to match text inside double curly braces
  const regex = /{{.*?}}/g;
  const parts = text.split(regex);
  const matches = text.match(regex) || [];

  
  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      if (part.trim()) {
        try {
          const res = await translatte(part, { from: srcLang, to: destLang });
          process.stdout.write("#"); 
          return res.text;
        } catch (err) {
          console.error(err);
          return part; 
        }
      }
      return part;
    })
  );

  // Reconstruct the string with translated parts and preserved placeholders
  let result = "";
  for (let i = 0; i < translatedParts.length; i++) {
    result += translatedParts[i];
    if (matches[i]) {
      result += " " + matches[i] + " ";
    }
  }

  return result;
  
}

async function updateTranslations(srcJson, destJson, srcLang, destLang) {
  const changes = {};
  const keysToRemove = new Set(Object.keys(destJson));
  for (const [key, value] of Object.entries(srcJson)) {
    keysToRemove.delete(key);
    if (!(key in destJson)) {
      if (typeof value === "object" && value !== null) {
        destJson[key] = await updateTranslations(value, {}, srcLang, destLang);
      } else {
        destJson[key] = value
          ? await translateText(value, srcLang, destLang)
          : "";
      }
      changes[key] = destJson[key];
    } else if (typeof value === "object" && value !== null) {
      const nestedChanges = await updateTranslations(
        value,
        destJson[key],
        srcLang,
        destLang
      );
      if (Object.keys(nestedChanges).length > 0) {
        changes[key] = nestedChanges;
      }
    }
  }

  for (const key of keysToRemove) {
    delete destJson[key];
    changes[key] = null;
    console.log(`Key removed: ${key}`);
  }
  return changes;
}

async function syncTranslationsForLanguage(destLang) {
  const destPath = `./i18n/${destLang}.json`;
  try {
    const srcJson = await readJSON(srcPath);
    let destJson = {};
    if (fs.existsSync(destPath)) {
      destJson = await readJSON(destPath);
    } else {
      console.log(`New translation file created for ${destLang}`);
    }
    const changes = await updateTranslations(
      srcJson,
      destJson,
      srcLang,
      destLang
    );
    if (Object.keys(changes).length > 0) {
      await writeJSON(destPath, destJson);
    } else {
      console.log(`No changes for ${destLang}.`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function syncTranslations() {
  const promisses = targetLangs.map((lang) => {
    console.log(`Syncing translations for ${lang}...`);
    return syncTranslationsForLanguage(lang);
  });
  await Promise.all(promisses);
  console.log("All translations synced!");
}

syncTranslations();
