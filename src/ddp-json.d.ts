import { DdpErrorJson } from "./ddp-error";

export declare interface DdpErrorMessageJson
{
    msg : "error";

    reason : string;

    offendingMessage? : any;
}

export declare interface DdpMethodMessageJson
{
    msg : "method";

    id : string;

    method : string;

    params? : any[];

    randomSeed? : any;
}

export declare interface DdpResultMessageJson
{
    msg : "result";

    id : string;

    error? : DdpErrorJson;

    result? : any;
}

export declare interface DdpUpdatedMessageJson
{
    msg : "updated";

    methods : string[];
}

export declare interface DdpSubMessageJson
{
    msg : "sub";

    id : string;

    name : string;

    params? : any[];
}

export declare interface DdpReadyMessageJson
{
    msg : "ready";

    subs : string[];
}

export declare interface DdpNoSubMessageJson
{
    msg : "nosub";

    id : string;

    error? : DdpErrorJson;
}

export declare interface DdpPingMessageJson
{
    msg : "ping";

    id? : string;
}

export declare interface DdpPongMessageJson
{
    msg : "pong";

    id? : string;
}

export declare interface DdpAddedMessageJson
{
    msg : "added";

    collection : string;

    id : string;

    fields? : any;
}

export declare interface DdpChangedMessageJson
{
    msg : "changed";

    collection : string;

    id : string;

    fields? : any;

    cleared? : string[];
}

export declare interface DdpRemovedMessageJson
{
    msg : "removed";

    collection : string;

    id : string;
}

export declare interface DdpAddedBeforeMessageJson
{
    msg : "addedBefore";

    collection : string;

    id : string;

    fields? : any;

    before : string | null;
}

export declare interface DdpMovedBeforeMessageJson
{
    msg : "movedBefore";

    collection : string;

    id : string;

    before : string | null;
}
