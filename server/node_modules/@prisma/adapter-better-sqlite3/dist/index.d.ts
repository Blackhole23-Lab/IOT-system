import type { Options } from 'better-sqlite3';
import type { SqlDriverAdapter } from '@prisma/driver-adapter-utils';
import type { SqlMigrationAwareDriverAdapterFactory } from '@prisma/driver-adapter-utils';

declare type BetterSQLite3InputParams = Options & {
    url: ':memory:' | (string & {});
};

export declare class PrismaBetterSqlite3 implements SqlMigrationAwareDriverAdapterFactory {
    #private;
    readonly provider = "sqlite";
    readonly adapterName: string;
    constructor(config: BetterSQLite3InputParams, options?: PrismaBetterSqlite3Options);
    connect(): Promise<SqlDriverAdapter>;
    connectToShadowDb(): Promise<SqlDriverAdapter>;
}

declare type PrismaBetterSqlite3Options = {
    shadowDatabaseUrl?: string;
    timestampFormat?: 'iso8601' | 'unixepoch-ms';
};

export { }
