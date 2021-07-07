export declare class DdpError
    extends Error
    implements DdpErrorJson
{
    public constructor(
        src? : DdpErrorJson | null
    );

    public readonly error : number | string;

    public readonly errorType : string;

    public readonly reason? : string;

    public toJSON() : DdpErrorJson;
}

export declare interface DdpErrorJson
{
    error : number | string;

    errorType : string;

    message? : string;

    reason? : string;
}
