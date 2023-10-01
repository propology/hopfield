import fs from 'fs';
import path from 'path';

const concatenateMarkdownFiles = async (
  inputFolder: string,
  outputFile: string,
) => {
  const getAllFiles = (folder: string, filesArr: string[] = []) => {
    const files = fs.readdirSync(folder);

    for (const file of files) {
      const filePath = path.join(folder, file);
      const stat = fs.statSync(filePath);

      // Ignore node_modules and symbolic links
      if (file === 'node_modules' || fs.lstatSync(filePath).isSymbolicLink()) {
        continue;
      }

      if (stat.isDirectory()) {
        getAllFiles(filePath, filesArr);
      } else if (path.extname(filePath) === '.md') {
        filesArr.push(filePath);
      }
    }

    return filesArr;
  };

  try {
    const markdownFiles = getAllFiles(inputFolder);

    let concatenatedContent = '';
    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, 'utf8');
      concatenatedContent += `${content.replace(/`/g, '')}'\n\n'`;
    }

    fs.writeFileSync(
      outputFile,
      `export const docs = \`${concatenatedContent}\`;\n`,
      'utf8',
    );
    console.log(`All markdown files concatenated into ${outputFile}`);
  } catch (error) {
    console.error('Error during concatenation:', error);
  }
};

const inputFolder = `${process.env.INIT_CWD}/docs`;
const outputFile = `${process.env.INIT_CWD}/examples/next-13-openai/src/app/docs.ts`;

concatenateMarkdownFiles(inputFolder, outputFile);