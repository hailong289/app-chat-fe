import fs from "fs";

const p = "src/app/docs/page.tsx";
let s = fs.readFileSync(p, "utf8");
const t = "d" + "i" + "v";

s = s.replace(
  new RegExp(
    `\\s+<${t} \\r?\\n\\s+key=\\{doc\\._id\\}\\r?\\n\\s+isPressable\\r?\\n\\s+onPress=\\{\\(\\) => router\\.push\\(\\\`/docs/\\$\\{doc\\._id\\}\\\`\\)\\}\\r?\\n\\s+className="w-full border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"\\r?\\n\\s+>\\r?\\n\\s+<CardBody`,
  ),
  `
              <Card
                key={doc._id}
                isPressable
                onPress={() => router.push(\`/docs/\${doc._id}\`)}
                className="w-full border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors h-full"
              >
                <CardBody`,
);

s = s.replace(
  new RegExp(`\\r?\\n\\s+</Card>\\r?\\n\\s+</${t}>`),
  "\n              </Card>",
);

fs.writeFileSync(p, s);
