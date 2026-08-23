import {
  readdirSync
} from "node:fs";

import {
  join
} from "node:path";

import {
  spawnSync
} from "node:child_process";

function runNode(args, label) {
  console.log("");
  console.log(
    `=== ${label} ===`
  );

  const result =
    spawnSync(
      process.execPath,
      args,
      {
        stdio: "inherit",
        env: process.env,
        windowsHide: true
      }
    );

  if (result.error) {
    console.error(
      `${label}: ${result.error.message}`
    );

    process.exit(1);
  }

  if (
    typeof result.status !== "number" ||
    result.status !== 0
  ) {
    console.error(
      `${label}: exit ${result.status}`
    );

    process.exit(
      typeof result.status === "number"
        ? result.status
        : 1
    );
  }
}

function listTests(dir) {
  return readdirSync(dir)
    .filter(
      (name) =>
        name.endsWith(".test.mjs")
    )
    .sort();
}

const root =
  process.cwd();

const webDir =
  join(
    root,
    "tests",
    "web"
  );

const webTests =
  listTests(webDir);

if (webTests.length === 0) {
  console.error(
    "No se encontraron tests Web."
  );

  process.exit(1);
}

console.log(
  `Web test files: ${webTests.length}`
);

for (
  let index = 0;
  index < webTests.length;
  index += 1
) {
  const name =
    webTests[index];

  runNode(
    [
      "--test",
      join(webDir, name)
    ],
    `WEB ${index + 1}/${webTests.length} ${name}`
  );
}

runNode(
  [
    join(
      root,
      "tests",
      "web",
      "bot",
      "run-local-tests.mjs"
    )
  ],
  "WEB BOT LOCAL"
);

const waDir =
  join(
    root,
    "tests",
    "whatsapp-v2"
  );

const waTests =
  listTests(waDir);

if (waTests.length === 0) {
  console.error(
    "No se encontraron tests WhatsApp."
  );

  process.exit(1);
}

console.log(
  `WhatsApp test files: ${waTests.length}`
);

for (
  let index = 0;
  index < waTests.length;
  index += 1
) {
  const name =
    waTests[index];

  runNode(
    [
      "--test",
      join(waDir, name)
    ],
    `WA ${index + 1}/${waTests.length} ${name}`
  );
}

console.log("");
console.log(
  "LOCAL_WEB2_SEQUENTIAL=PASS"
);