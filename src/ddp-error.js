const { isReferenceType, isNumber, isString } = require("kaphein-js-type-trait");

module.exports = (function ()
{
    /**
     *  @typedef {import("./ddp-error").DdpErrorJson} DdpErrorJson
     */

    class DdpError extends Error
    {
        /**
         *  @param {DdpErrorJson | null | undefined} [src]
         */
        constructor(src = void 0)
        {
            super();

            this.error = 500;
            this.errorType = "Meteor.Error";

            if(isReferenceType(src))
            {
                if(isString(src.errorType) || isNumber(src.errorType))
                {
                    this.error = src.error;
                }

                if(isString(src.errorType))
                {
                    this.errorType = src.errorType;
                }

                if(isString(src.reason))
                {
                    this.reason = src.reason;
                }

                if(isString(src.message))
                {
                    this.message = src.message;
                }
            }

            if(!isString(this.message))
            {
                this.message = (
                    isString(this.reason)
                        ? this.reason + " [" + this.error + "]"
                        : "[" + this.error + "]"
                );
            }

            this.name = "DdpError";

            if(Error.captureStackTrace)
            {
                Error.captureStackTrace(this, DdpError);
            }
        }

        toJSON()
        {
            return Object.assign(
                {
                    error : this.error,
                    errorType : this.errorType,
                    message : this.message
                },
                (isString(this.reason) ? { reason : this.reason } : void 0)
            );
        }
    }

    return {
        DdpError,
    };
})();
