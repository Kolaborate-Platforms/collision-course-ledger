# Fee schedule

The schedule lives in `src/fees/schedule.js`. Amounts are whole Ugandan shillings (UGX). A band applies when the amount is at or below its upper limit and above the previous band's limit.

## Send

| Amount up to | Fee            |
| ------------ | -------------- |
| 5,000        | 150 flat       |
| 50,000       | 500 flat       |
| 500,000      | 1% of amount   |
| 5,000,000    | 0.8% of amount |

The sender pays the fee on top of the amount. The fee is credited to `SYSTEM_FEES`.

The rates in this repository are made up for the exercise. They are not the rates of any real operator or tax authority.
