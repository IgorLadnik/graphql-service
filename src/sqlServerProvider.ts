const sql = require('mssql/msnodesqlv8');
import { ILogger } from './logger';

export class SqlServerProvider {
    constructor(private readonly config: any, private l: ILogger) {
        this.l = l;
        this.config = {
            server: config.server,
            database: config.database,

            options: {
                trustedConnection: true
            }
        }
    }

    async connect() {
        try {
            await sql.connect(this.config);
        }
        catch (err) {
            this.l.log(err);
        }
    }

    async query(strQuery: string): Promise<Array<any>> {
        let request = new sql.Request();
        let retRecordset = new Array<any>();
        try {
            retRecordset = (await request.query(strQuery)).recordset;
        }
        catch (err) {
            this.l.log(err);
        }

        return retRecordset;
    }
}
