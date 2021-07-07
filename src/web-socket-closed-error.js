const { isString } = require("kaphein-js-type-trait");

module.exports = (function ()
{
    class WebSocketClosedError extends Error
    {
        /**
         *  @param {string} [message]
         *  @param {number} [closeCode]
         */
        constructor(message = void 0, closeCode = void 0)
        {
            super(message);

            this.name = "WebSocketClosedError";
            this.message = (isString(message) ? message : "");
            this.closeCode = (Number.isInteger(closeCode) ? closeCode : 1006);

            if(Error.captureStackTrace)
            {
                Error.captureStackTrace(this, WebSocketClosedError);
            }
        }
    }

    return {
        WebSocketClosedError,
    };
})();
