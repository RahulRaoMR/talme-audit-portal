import "../src/config/loadEnv.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

// Additive deployment with read-only fingerprints of every pre-existing table.
// No records, password hashes or credentials are written to the report.
const client = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } } });
const schema = new URL(process.env.DATABASE_URL_UNPOOLED!).searchParams.get("schema") || "public";
const quote = (value:string) => `"${value.replaceAll('"','""')}"`;
const tables = Prisma.dmmf.datamodel.models.filter((model) => !["RiskAssessment","RiskScoringConfiguration"].includes(model.name)).map((model)=>model.dbName??model.name);
async function snapshot(){
  const rows:Record<string,{count:string;digest:string}>={};
  for(const table of tables){
    const data = await client.$queryRawUnsafe<Array<{count:bigint;digest:string}>>(`SELECT count(*) AS count, md5(coalesce(string_agg((to_jsonb(t)-'riskId'-'riskConfigurationId')::text, '' ORDER BY (to_jsonb(t)-'riskId'-'riskConfigurationId')::text),'')) AS digest FROM ${quote(schema)}.${quote(table)} t`);
    rows[table]={count:String(data[0].count),digest:data[0].digest};
  }
  return rows;
}
try{
  const before=await snapshot();
  const deployed=spawnSync(process.execPath,["../node_modules/tsx/dist/cli.mjs","scripts/prisma.ts","migrate","deploy"],{cwd:process.cwd(),env:process.env,stdio:"inherit",windowsHide:true});
  assert.equal(deployed.status,0,"Risk migration must deploy successfully");
  const after=await snapshot();assert.deepEqual(after,before,"Every pre-existing application record must remain unchanged");
  const config=await client.riskScoringConfiguration.findUniqueOrThrow({where:{id:"default"}});
  const tablesWithRls=await client.$queryRaw<Array<{relname:string;relrowsecurity:boolean}>>`SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname=${schema} AND relname IN ('RiskAssessment','RiskScoringConfiguration')`;
  assert.ok(tablesWithRls.length===2&&tablesWithRls.every((row)=>row.relrowsecurity));
  const report={migration:"20261030140000_risk_assessment",existingTablesChecked:tables.length,allExistingRecordFingerprintsUnchanged:true,existingCounts:Object.fromEntries(Object.entries(after).map(([name,value])=>[name,Number(value.count)])),riskCount:await client.riskAssessment.count(),scoringVersion:config.version,newTablesWithRLS:tablesWithRls.length};
  const output=path.resolve("../docs/verification");await mkdir(output,{recursive:true});await writeFile(path.join(output,"risk-database-validation.json"),JSON.stringify(report,null,2)+"\n");
  console.log(`PASS: Risk Assessment migration deployed; records in all ${tables.length} existing tables are unchanged.`);
  console.log(`PASS: ${report.riskCount} live risks; scoring configuration present; both new tables have RLS.`);
}catch(error){console.error(error instanceof assert.AssertionError?error.message:"Risk migration/preservation check failed; inspect migration status without exposing connection credentials.");process.exitCode=1;}
finally{await client.$disconnect();}
