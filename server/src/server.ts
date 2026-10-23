import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.port, () => {
  console.log(`TALME Employee Audit Portal API running on port ${env.port}`);
});

