// @ts-check

/**
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunInput} CartPaymentMethodsTransformRunInput
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunResult} CartPaymentMethodsTransformRunResult
 */

/**
 * @type {CartPaymentMethodsTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartPaymentMethodsTransformRunInput} input
 * @returns {CartPaymentMethodsTransformRunResult}
 */
export function cartPaymentMethodsTransformRun(input) {
  // Check if COD is verified
  const isCodVerified = input?.cart?.attribute?.value === "Yes";

  // If verified, show everything
  if (isCodVerified) {
    return NO_CHANGES;
  }

  // If NOT verified, hide COD payment methods
  const codMethods = input.paymentMethods.filter(method => {
    const name = method.name.toLowerCase();
    return name.includes("cash on delivery") || name.includes("delivery") || name.includes("cod");
  });

  if (codMethods.length > 0) {
    return {
      operations: codMethods.map(method => ({
        paymentMethodHide: {
          paymentMethodId: method.id
        }
      }))
    };
  }

  return NO_CHANGES;
}