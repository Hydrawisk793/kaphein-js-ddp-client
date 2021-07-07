const {
    isUndefined,
    isDefinedAndNotNull,
    isReferenceType,
    isString,
    isArray
} = require("kaphein-js-type-trait");
const { StringKeyMap } = require("kaphein-js-collection");
const { EventEmitter } = require("kaphein-js-event-emitter");
const { ulid } = require("ulid");
const EJSON = require("ddp-ejson");

const { DdpError } = require("./ddp-error");
const { WebSocketClosedError } = require("./web-socket-closed-error");

module.exports = (function ()
{
    /* global WebSocket */

    /**
     *  @typedef {import("./ddp-json").DdpMethodMessageJson} DdpMethodMessageJson
     *  @typedef {import("./ddp-json").DdpResultMessageJson} DdpResultMessageJson
     *  @typedef {import("./ddp-json").DdpSubMessageJson} DdpSubMessageJson
     *  @typedef {import("./ddp-json").DdpReadyMessageJson} DdpReadyMessageJson
     *  @typedef {import("./ddp-json").DdpNoSubMessageJson} DdpNoSubMessageJson
     *  @typedef {import("./ddp-json").DdpErrorMessageJson} DdpErrorMessageJson
     *  @typedef {import("./ddp-client").DdpClientEventListenerMap} DdpClientEventListenerMap
     */

    /**
     *  @typedef {{
            client : DdpClient;

            json : DdpMethodMessageJson;

            promise : Promise<any>;

            resolve : (value : any) => void;

            reject : (reason? : any) => void;
        }} DdpMethodInvocation
     */
    /**
     *  @typedef {{
            client : DdpClient;

            json : DdpSubMessageJson;

            promise : Promise<any>;

            resolve : (value : any) => void;

            reject : (reason? : any) => void;
        }} DdpSubInvocation
     */

    /**
     *  @readonly
     *  @enum {number}
     */
    const State = {
        IDLE : 0,
        OPENING : 1,
        OPENED : 2,
        CORRUPTED : 3,
        CLOSING : 4
    };

    class DdpClient
    {
        constructor()
        {
            if("undefined" === typeof Promise)
            {
                throw new Error("ECMAScript 6 Promise is not available in this environment.");
            }

            this._state = State.IDLE;
            /** @type {EventEmitter<DdpClientEventListenerMap>} */this._evtEmt = new EventEmitter({
                xBindThis : false,
                xEmitNewListenerEvent : false,
                xEmitRemoveListenerEvent : false,
                xPassRawListenerOnRemoveListenerEvent : false,
                xPreventDuplicateListeners : true,
                xStrictMaxListenerCount : false,
                xWarnIfMaxListenerCountExceeds : false
            });
            this._promise = Promise.resolve();
            /** @type {typeof WebSocket} */this._WebSocket = null;
            /** @type {WebSocket} */this._ws = null;
            this._wsClosedByError = false;
            /** @type {string | null} */this._sessionId = null;
            /** @type {Map<string, DdpMethodInvocation>} */this._mtdNvocs = new StringKeyMap();
            /** @type {Map<string, DdpSubInvocation>} */this._subNvocs = new StringKeyMap();

            this._wsOnMessage = _wsOnMessage.bind(this);
            this._wsOnError = _wsOnError.bind(this);
            this._wsOnClose = _wsOnClose.bind(this);
        }

        addListener(eventName, listener)
        {
            this._evtEmt.addListener(eventName, listener);

            return this;
        }

        removeListener(eventName, listener)
        {
            this._evtEmt.removeListener(eventName, listener);

            return this;
        }

        on(eventName, listener)
        {
            this._evtEmt.on(eventName, listener);

            return this;
        }

        once(eventName, listener)
        {
            this._evtEmt.once(eventName, listener);

            return this;
        }

        off(eventName, listener)
        {
            this._evtEmt.off(eventName, listener);

            return this;
        }

        getState()
        {
            return this._state;
        }

        isOpened()
        {
            return State.OPENED === this._state;
        }

        getSessionId()
        {
            return this._sessionId;
        }

        getSocket()
        {
            return this._ws || null;
        }

        getServerUrl()
        {
            return this._ws ? this._ws.url : null;
        }

        open(url, option = void 0)
        {
            var promise = this._promise
                .then(() => _open(this, url, option))
            ;
            this._promise = promise
                .catch(function ()
                {
                    // Ignore errors.
                })
            ;

            return promise;
        }

        close(reason = void 0)
        {
            var promise = this._promise
                .then(() => _close(this, reason))
            ;
            this._promise = promise;

            return promise;
        }

        callMethod(name, params = void 0, id = void 0, randomSeed = void 0)
        {
            return new Promise((resolve) =>
            {
                _assertIsOpened(this);

                var json = _createMethodJson(
                    this,
                    name,
                    params,
                    id,
                    randomSeed
                );
                _sendEjsonValue(this, json);

                resolve(_addMethodInvocation(this, json).promise);
            });
        }

        subscribe(name, id = void 0, params = void 0)
        {
            return new Promise((resolve) =>
            {
                _assertIsOpened(this);

                var json = _createSubJson(
                    this,
                    name,
                    id,
                    params
                );
                _sendEjsonValue(this, json);

                resolve(_addSubInvocation(this, json).promise);
            });
        }

        unsubscribe(id)
        {
            if(!isString(id))
            {
                throw new TypeError("'id' must be a string.");
            }

            _sendEjsonValue(this, {
                msg : "unsub",
                id : id
            });
        }
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {string} url
     *  @param {Record<string, any>} option
     */
    function _open(thisRef, url, option)
    {
        return /** @type {Promise<WebSocket>} */(new Promise(function (resolve)
        {
            if(State.IDLE !== thisRef._state)
            {
                throw new Error("The DDP client is not in idle state.");
            }
            _changeState(thisRef, State.OPENING);

            if(!isString(url) || !url)
            {
                throw new TypeError("'url' must be a non-empty string.");
            }

            thisRef._wsClosedByError = false;
            thisRef._WebSocket = (option && option.WebSocket) || null;
            if(!isReferenceType(thisRef._WebSocket))
            {
                if("undefined" === typeof WebSocket)
                {
                    throw new Error("An implementation of `WebSocket` must be provided via `option.WebSocket`.");
                }

                thisRef._WebSocket = WebSocket;
            }

            thisRef._evtEmt.emit(
                "opening",
                {
                    source : thisRef
                }
            );

            resolve(new Promise(function (resolve, reject)
            {
                var ws = new thisRef._WebSocket(url);
                ws.addEventListener("error", thisRef._wsOnError);

                function onOpen()
                {
                    ws.removeEventListener("close", onOpenFailed);
                    resolve(ws);
                }

                /**
                 *  @param {WebSocketEventMap["close"]} e
                 */
                function onOpenFailed(e)
                {
                    ws.removeEventListener("open", onOpen);
                    reject(new Error(e.reason));
                }

                ws.addEventListener("open", onOpen, { once : true });
                ws.addEventListener("close", onOpenFailed, { once : true });
            }));
        }))
            .then(function (ws)
            {
                thisRef._ws = ws;

                return new Promise(function (resolve, reject)
                {
                    /**
                     *  @param {MessageEvent} e
                     */
                    function onMessage(e)
                    {
                        var json = _tryParseEjson(e.data);
                        switch((json && json.msg) || "")
                        {
                        case "connected":
                            ws.removeEventListener("message", onMessage);
                            ws.addEventListener("message", thisRef._wsOnMessage);
                            ws.addEventListener("close", thisRef._wsOnClose);
                            thisRef._sessionId = (isString(json.session) ? json.session : null);
                            resolve();
                            break;
                        case "failed":
                            ws.removeEventListener("message", onMessage);
                            reject(new Error("The serve wants to communicate with following protocol version: " + json.version));
                            break;
                        default:
                            // Ignore the other messages.
                        }
                    }

                    ws.addEventListener("message", onMessage);
                    _sendEjsonValue(thisRef, {
                        msg : "connect",
                        version : "1",
                        support : ["1"]
                    });
                });
            })
            .then(function ()
            {
                _changeState(thisRef, State.OPENED);
                thisRef._evtEmt.emit(
                    "opened",
                    {
                        source : thisRef
                    }
                );
            })
            .catch(function (error)
            {
                _changeState(thisRef, State.CORRUPTED);
                thisRef._evtEmt.emit(
                    "openFailed",
                    {
                        souce : thisRef,
                        error : error
                    }
                );

                return _cleanUp(thisRef, error)
                    .then(function ()
                    {
                        throw error;
                    })
                ;
            })
        ;
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {any} reason
     */
    function _close(thisRef, reason)
    {
        var promise = null;

        switch(thisRef._state)
        {
        case State.OPENED:
        case State.CORRUPTED:
            promise = _cleanUp(thisRef, reason);
            break;
        default:
            promise = Promise.resolve();
        }

        return promise;
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {any} reason
     */
    function _cleanUp(thisRef, reason)
    {
        var eventArgs = Object.assign(
            {
                source : thisRef
            },
            (isUndefined(reason) ? void 0 : { reason : reason })
        );

        return new Promise(function (resolve)
        {
            _changeState(thisRef, State.CLOSING);
            resolve(Promise.allSettled(thisRef._evtEmt.emitAndGetResults("closing", eventArgs)));
        })
            .then(function ()
            {
                thisRef._subNvocs.forEach(function (nvoc)
                {
                    nvoc.reject(new Error("Subscription request has been canceled because the DDP client has been closed."));
                });
                thisRef._mtdNvocs.forEach(function (nvoc)
                {
                    nvoc.reject(new Error("Method call canceled because the DDP client has been closed."));
                });

                return new Promise(function (resolve)
                {
                    // eslint-disable-next-line no-unused-vars
                    function onClosed(e)
                    {
                        resolve();
                    }

                    thisRef._sessionId = null;

                    var ws = thisRef._ws;
                    thisRef._ws = null;
                    if(ws)
                    {
                        ws.removeEventListener("message", thisRef._wsOnMessage);
                        ws.removeEventListener("error", thisRef._wsOnError);
                        ws.removeEventListener("close", thisRef._wsOnClose);

                        if(
                            thisRef._WebSocket
                            && thisRef._WebSocket.CLOSED !== ws.readyState
                        )
                        {
                            ws.addEventListener("close", onClosed, { once : true });
                            ws.close(1000);
                        }
                        else
                        {
                            resolve();
                        }
                    }
                    else
                    {
                        resolve();
                    }
                });
            })
            .then(function ()
            {
                _changeState(thisRef, State.IDLE);
                thisRef._evtEmt.emit("closed", eventArgs);
            })
        ;
    }

    /**
     *  @type {Record<
            string,
            (
                thisRef : DdpClient,
                json : Record<string, any>
            ) => void
        }
     */
    var _ddpMsgHandlers = {
        /**
         *  @param {DdpErrorMessageJson} json
         */
        "error" : function (thisRef, json)
        {
            var offendingMessage = json.offendingMessage;
            if(offendingMessage)
            {
                var msg = offendingMessage.msg;
                switch(msg)
                {
                case "method": (function ()
                {
                    var id = offendingMessage.id;
                    var nvoc = thisRef._mtdNvocs.get(id);
                    if(nvoc)
                    {
                        nvoc.reject(new Error(json.reason));
                    }
                })();
                    break;
                case "sub": (function ()
                {
                    var id = offendingMessage.id;
                    var nvoc = thisRef._subNvocs.get(id);
                    if(nvoc)
                    {
                        nvoc.reject(new Error(json.reason));
                    }
                })();
                    break;
                default:
                    // Does nothing.
                }
            }
        },

        "ping" : function (thisRef, json)
        {
            _sendEjsonValue(thisRef, Object.assign(
                {
                    msg : "pong"
                },
                ("id" in json ? { id : json.id } : void 0)
            ));
        },

        /**
         *  @param {DdpResultMessageJson} json
         */
        "result" : function (thisRef, json)
        {
            if(isString(json.id))
            {
                var nvoc = thisRef._mtdNvocs.get(json.id);
                if(nvoc)
                {
                    if("error" in json)
                    {
                        nvoc.reject(new DdpError(json.error));
                    }
                    else
                    {
                        nvoc.resolve(json.result);
                    }

                    thisRef._evtEmt.emit(
                        "methodCallFinished",
                        {
                            source : thisRef,
                            method : nvoc.json,
                            result : json
                        }
                    );
                }
            }
        },

        /**
         *  @param {DdpReadyMessageJson} json
         */
        "ready" : function (thisRef, json)
        {
            var subs = json.subs;
            if(isArray(subs))
            {
                subs.forEach(function (id)
                {
                    if(isString(id))
                    {
                        var nvoc = thisRef._subNvocs.get(id);
                        if(nvoc)
                        {
                            nvoc.resolve(id);
                        }
                    }
                });
            }
        },

        /**
         *  @param {DdpNoSubMessageJson} json
         */
        "nosub" : function (thisRef, json)
        {
            if(isString(json.id))
            {
                var nvoc = thisRef._subNvocs.get(json.id);
                if(nvoc)
                {
                    if("error" in json)
                    {
                        nvoc.reject(new DdpError(json.error));
                    }
                }
            }
        }
    };

    /**
     *  @this {DdpClient}
     *  @param {WebSocketEventMap["message"]} e
     */
    function _wsOnMessage(e)
    {
        var ejson = _tryParseEjson(e.data);
        if(ejson)
        {
            var msg = ejson.msg;
            if(isString(msg))
            {
                var ddpMsgHandler = _ddpMsgHandlers[msg];
                if(ddpMsgHandler)
                {
                    ddpMsgHandler(this, ejson);
                }

                this._evtEmt.emit(
                    "messageArrived",
                    {
                        source : this,
                        message : ejson
                    }
                );
            }
        }
    }

    /**
     *  @this {DdpClient}
     */
    function _wsOnError()
    {
        _changeState(this, State.CORRUPTED);
        this._wsClosedByError = true;
    }

    /**
     *  @this {DdpClient}
     *  @param {WebSocketEventMap["close"]} e
     */
    function _wsOnClose(e)
    {
        var error = void 0;

        var code = (e && e.code) || (State.CORRUPTED === this._state ? 1006 : 1000);
        if(1000 !== code)
        {
            error = new WebSocketClosedError(
                (e && e.reason) || "An unknown web socket error has occurred.",
                code
            );

            if(this._state < State.CORRUPTED)
            {
                this._evtEmt.emit(
                    "errorOccurred",
                    {
                        source : this,
                        error : error
                    }
                );
            }
        }

        this.close(error);
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {State} state
     */
    function _changeState(thisRef, state)
    {
        var prevState = thisRef._state;
        thisRef._state = state;

        if(prevState !== state)
        {
            thisRef._evtEmt.emit(
                "stateChanged",
                {
                    source : thisRef,
                    state : {
                        oldValue : prevState,
                        newValue : state
                    }
                }
            );
        }
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {string} name
     */
    function _createMethodJson(thisRef, name, params, id, randomSeed)
    {
        if(!isString(name))
        {
            throw new TypeError("'name' must be a string.");
        }

        if(isDefinedAndNotNull(params) && !isArray(params))
        {
            throw new TypeError("'params' must be an array of EJSON objects.");
        }

        if(isDefinedAndNotNull(id) && (!isString(id) || !id))
        {
            throw new TypeError("'id' must be a non-empty string.");
        }
        else
        {
            id = ulid();
        }
        if(thisRef._mtdNvocs.has(id))
        {
            throw new Error("'id' must be unique.");
        }

        if(!isUndefined(randomSeed))
        {
            if(isUndefined(_tryParseEjson(randomSeed)))
            {
                throw new Error("'randomSeed' must be a JSON value.");
            }
        }

        return /** @type {DdpMethodMessageJson} */(Object.assign(
            {
                msg : "method",
                id : id,
                method : name
            },
            (params ? { params : params } : void 0),
            (randomSeed ? { randomSeed : randomSeed } : void 0)
        ));
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {string} name
     */
    function _createSubJson(thisRef, name, id, params)
    {
        if(!isString(name))
        {
            throw new TypeError("'name' must be a string.");
        }

        if(isDefinedAndNotNull(params) && !isArray(params))
        {
            throw new TypeError("'params' must be an array of EJSON objects.");
        }

        if(isDefinedAndNotNull(id) && (!isString(id) || !id))
        {
            throw new TypeError("'id' must be a non-empty string.");
        }
        else
        {
            id = ulid();
        }
        if(thisRef._subNvocs.has(id))
        {
            throw new Error("'id' must be unique.");
        }

        return /** @type {DdpSubMessageJson} */(Object.assign(
            {
                msg : "sub",
                id : id,
                name : name
            },
            (params ? { params : params } : void 0)
        ));
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {DdpMethodMessageJson} json
     */
    function _addMethodInvocation(thisRef, json)
    {
        /** @type {DdpMethodInvocation} */var nvoc = {
            client : thisRef,
            json : json,
            promise : null,
            resolve : null,
            reject : null
        };
        nvoc.promise = new Promise(function (resolve, reject)
        {
            nvoc.resolve = function (value)
            {
                nvoc.client._mtdNvocs["delete"](nvoc.json.id);
                nvoc.promise = null;
                nvoc.resolve = null;
                nvoc.reject = null;

                resolve(value);
            };
            nvoc.reject = function (reason)
            {
                nvoc.client._mtdNvocs["delete"](nvoc.json.id);
                nvoc.promise = null;
                nvoc.resolve = null;
                nvoc.reject = null;

                reject(reason);
            };
        });
        thisRef._mtdNvocs.set(json.id, nvoc);

        return nvoc;
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {DdpSubMessageJson} json
     */
    function _addSubInvocation(thisRef, json)
    {
        /** @type {DdpSubInvocation} */var nvoc = {
            client : thisRef,
            json : json,
            promise : null,
            resolve : null,
            reject : null
        };
        nvoc.promise = new Promise(function (resolve, reject)
        {
            nvoc.resolve = function (value)
            {
                nvoc.client._subNvocs["delete"](nvoc.json.id);
                nvoc.promise = null;
                nvoc.resolve = null;
                nvoc.reject = null;

                resolve(value);
            };
            nvoc.reject = function (reason)
            {
                nvoc.client._subNvocs["delete"](nvoc.json.id);
                nvoc.promise = null;
                nvoc.resolve = null;
                nvoc.reject = null;

                reject(reason);
            };
        });
        thisRef._subNvocs.set(nvoc.json.id, nvoc);

        return nvoc;
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {any} v
     */
    function _sendEjsonValue(thisRef, v)
    {
        thisRef._ws.send(EJSON.stringify(v));
    }

    /**
     *  @param {DdpClient} thisRef
     *  @param {string} [message]
     */
    function _assertIsOpened(thisRef)
    {
        if(!thisRef.isOpened())
        {
            throw new Error(arguments[1] || "The DDP client is not opened.");
        }
    }

    function _tryParseEjson(v)
    {
        /** @type {any} */var ejson = void 0;

        try
        {
            ejson = EJSON.parse(v);
        }
        catch(error)
        {
            // Ignore errors.
        }

        return ejson;
    }

    return {
        DdpClientState : State,
        DdpClient
    };
})();
