export interface ILogger {
    log(message: string): void;
}

export class Logger implements ILogger {
    log(message: string) {
        console.log(message);
    }
}


