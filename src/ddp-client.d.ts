import { MayBePromise } from "kaphein-ts-type-utils";
import { EventListenable } from "kaphein-js-event-emitter";

import {
    DdpErrorMessageJson,
    DdpMethodMessageJson,
    DdpResultMessageJson,
    DdpUpdatedMessageJson,
    DdpReadyMessageJson,
    DdpNoSubMessageJson,
    DdpPingMessageJson,
    DdpPongMessageJson,
    DdpAddedMessageJson,
    DdpChangedMessageJson,
    DdpRemovedMessageJson,
    DdpAddedBeforeMessageJson,
    DdpMovedBeforeMessageJson,
} from "./ddp-json";

export declare class DdpClient
    implements EventListenable<DdpClientEventListenerMap>
{
    public constructor();

    public addListener<K extends keyof DdpClientEventListenerMap>(
        eventName : K,
        listener : DdpClientEventListenerMap[K]
    ) : this;

    public removeListener<K extends keyof DdpClientEventListenerMap>(
        eventName : K,
        listener : DdpClientEventListenerMap[K]
    ) : this;

    public on<K extends keyof DdpClientEventListenerMap>(
        eventName : K,
        listener : DdpClientEventListenerMap[K]
    ) : this;

    public once<K extends keyof DdpClientEventListenerMap>(
        eventName : K,
        listener : DdpClientEventListenerMap[K]
    ) : this;

    public off<K extends keyof DdpClientEventListenerMap>(
        eventName : K,
        listener : DdpClientEventListenerMap[K]
    ) : this;

    public getState() : DdpClientState;

    public isOpened() : boolean;

    public getServerUrl() : string | null;

    public getSessionId() : string | null;

    public getSocket() : WebSocket | null;

    public open(
        url : string,
        option : {
            WebSocket? : typeof WebSocket;
        }
    ) : Promise<void>;

    public close(
        reason? : any
    ) : Promise<void>;

    public callMethod(
        name : string,
        params? : any[] | null,
        id? : string | null,
        randomSeed? : any
    ) : Promise<DdpResultMessageJson["result"]>;

    public subscribe(
        name : string,
        id? : string | null,
        params? : any[] | null
    ) : Promise<string>;

    public unsubscribe(
        id : string
    ) : void;
}

export declare enum DdpClientState
{
    IDLE = 0,

    OPENING = 1,

    OPENED = 2,

    CORRUPTED = 3,

    CLOSING = 4,
}

export declare interface DdpClientEventMap
{
    "stateChanged" : {
        source : DdpClient;

        state : {
            oldValue : DdpClientState;

            newValue : DdpClientState;
        };
    };

    "opening" : {
        source : DdpClient;
    };

    "opened" : {
        source : DdpClient;
    };

    "openFailed" : {
        souce : DdpClient;

        error : Error;
    };

    "methodCallFinished" : {
        source : DdpClient;

        method : DdpMethodMessageJson;

        result : DdpResultMessageJson;
    };

    "messageArrived" : {
        souce : DdpClient;

        message : DdpErrorMessageJson
            | DdpPingMessageJson
            | DdpPongMessageJson
            | DdpResultMessageJson
            | DdpUpdatedMessageJson
            | DdpReadyMessageJson
            | DdpNoSubMessageJson
            | DdpAddedMessageJson
            | DdpChangedMessageJson
            | DdpRemovedMessageJson
            | DdpAddedBeforeMessageJson
            | DdpMovedBeforeMessageJson
        ;
    };

    "errorOccurred" : {
        source : DdpClient;

        error : Error;
    },

    "closing" : {
        source : DdpClient;

        reason? : any;
    };

    "closed" : {
        source : DdpClient;

        reason? : any;
    };
}

export declare type DdpClientEventListenerMap = {
    [ K in keyof DdpClientEventMap ] : (
        e : DdpClientEventMap[K]
    ) => MayBePromise<void>;
};
 