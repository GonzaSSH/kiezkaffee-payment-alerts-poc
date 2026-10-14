// Turns a failure reason into words a support person can act on.
import type { FailureReason } from './types';

export interface Explanation {
  title: string;
  explanation: string;
  nextStep: string;
}

const EXPLANATIONS: Record<Exclude<FailureReason, 'unknown'>, Explanation> = {
  declined: {
    title: 'Card declined',
    explanation: "The customer's bank declined the card and did not say why.",
    nextStep: 'Contact the customer and ask them to use another card or payment method.',
  },
  insufficient_funds: {
    title: 'Insufficient funds',
    explanation: 'The card did not have enough money for this order.',
    nextStep: 'Contact the customer and offer a new payment link, or ask for another card.',
  },
  expired_card: {
    title: 'Expired card',
    explanation: 'The card has expired.',
    nextStep: 'Ask the customer to update their card details and pay again.',
  },
  incorrect_cvc: {
    title: 'Wrong security code',
    explanation: 'The 3-digit security code on the back of the card was wrong.',
    nextStep: 'Ask the customer to check the security code and pay again.',
  },
  lost_or_stolen: {
    title: 'Card blocked by the bank',
    explanation: 'The bank has blocked this card.',
    nextStep:
      'Tell the customer the payment was declined and offer another payment method. Do not mention that the card was reported lost or stolen.',
  },
  processing_error: {
    title: 'Processing error',
    explanation: 'Something went wrong while the payment was being processed. It was not the customer’s fault.',
    nextStep: 'Wait a few minutes, then ask the customer to try again with the same card.',
  },
  too_many_attempts: {
    title: 'Too many attempts',
    explanation: 'The bank stopped the card after too many payments in a short time.',
    nextStep: 'Ask the customer to wait a while or use another card.',
  },
};

export function explain(reason: FailureReason, providerCode: string): Explanation {
  if (reason === 'unknown') {
    return {
      title: 'Unrecognised failure reason',
      explanation: `The payment provider gave a reason we don't recognise (${providerCode}).`,
      nextStep: "Check this payment in the payment provider's dashboard, then contact the customer.",
    };
  }
  return EXPLANATIONS[reason];
}
