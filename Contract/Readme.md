---

## Supay Contract Specification

This document outlines the specification for the `payment_splitter` Move contract on Sui, designed to manage shared expenses and debts within a group.

### I. Overview

The `payment_splitter` contract facilitates the creation and management of groups for splitting expenses, tracking individual member balances, and simplifying debts. It uses Sui's object model and features like shared objects, tables, and events to provide a robust and transparent solution for group finance management.

### II. Error Codes

The contract defines the following error codes to indicate specific failure conditions:

* **`ENotGroupMember: 1`**: The interacting address is not a member of the group.
* **`EAlreadyMember: 2`**: The address to be added is already a member of the group.
* **`EInsufficientFunds: 3`**: The member attempting to withdraw does not have sufficient funds in their in-group balance.
* **`ENoBalanceToWithdraw: 6`**: The member attempting to withdraw has no balance to withdraw.
* **`ENotGroupOwner: 7`**: The interacting address is not the owner of the group.
* **`ESelfPayment: 8`**: An attempt was made to make a payment to oneself.
* **`EDebtNotFound: 11`**: No outstanding debt was found between the specified debtor and creditor.

### III. Structures

#### 1. `Group`

A **`Group`** object represents a shared expense group. It holds all the necessary data for managing members, expenses, and debts.

* **`id: UID`**: Unique ID of the group object.
* **`name: vector<u8>`**: The name of the group (e.g., "Roommates," "Vacation Fund").
* **`owner: address`**: The address of the group creator, who has administrative privileges.
* **`members: vector<address>`**: A dynamic list of addresses that are part of the group.
* **`expenses: vector<ID>`**: A list of `ID`s referencing `Expense` objects associated with this group.
* **`member_balances: Table<address, Balance<SUI>>`**: A table mapping member addresses to their available SUI balances within the group, for withdrawals.
* **`member_credits: Table<address, u64>`**: A table tracking the total amount of money each member is owed by others (positive net balance).
* **`member_debits: Table<address, u64>`**: A table tracking the total amount of money each member owes to others (negative net balance).
* **`debt_matrix: Table<address, Table<address, u64>>`**: A nested table representing the direct debt relationships between members. `debt_matrix[debtor][creditor]` stores the amount `debtor` owes `creditor`.
* **`total_expenses: u64`**: The cumulative sum of all expenses recorded in the group.
* **`total_settlements: u64`**: The cumulative sum of all settled debts within the group.

#### 2. `Expense`

An **`Expense`** object represents a single shared expense within a group.

* **`id: UID`**: Unique ID of the expense object.
* **`group_id: ID`**: The ID of the `Group` to which this expense belongs.
* **`description: vector<u8>`**: A description of the expense (e.g., "Groceries," "Rent").
* **`payer: address`**: The address of the member who paid for the expense initially.
* **`amount: u64`**: The total amount of the expense.
* **`participants: vector<address>`**: A list of member addresses who are participating in this expense.
* **`shares: Table<address, u64>`**: A table mapping participant addresses to their allocated share of the expense.
* **`settled: bool`**: A flag indicating if the expense has been fully settled (though individual debts might still exist).
* **`timestamp: u64`**: The epoch timestamp when the expense was created.

#### 3. `Debt`

A **`Debt`** object is a transient structure used for tracking who owes whom. This struct is marked `drop`, meaning it doesn't persist on-chain as a top-level object but is used internally for data representation.

* **`debtor: address`**: The address of the member who owes money.
* **`creditor: address`**: The address of the member who is owed money.
* **`amount: u64`**: The amount of the debt.
* **`expense_id: ID`**: The ID of the `Expense` that originated this debt. An ID of `@0x0` can indicate a general payment not tied to a specific expense.
* **`paid: bool`**: A flag indicating if this specific debt entry has been paid. (Note: The debt matrix directly tracks outstanding amounts, so this flag is more for event emission context).

#### 4. `Settlement`

A **`Settlement`** object records a payment or settlement transaction between two members.

* **`id: UID`**: Unique ID of the settlement object.
* **`group_id: ID`**: The ID of the `Group` where the settlement occurred.
* **`from: address`**: The address of the member who made the payment.
* **`to: address`**: The address of the member who received the payment.
* **`amount: u64`**: The amount transferred during settlement.
* **`timestamp: u64`**: The epoch timestamp when the settlement occurred.
* **`note: vector<u8>`**: A short description or note about the settlement.

### IV. Events

The contract emits events to provide off-chain transparency and enable easier indexing of activities.

* **`ExpenseCreated`**: Emitted when a new expense is successfully created.
    * `expense_id: ID`
    * `group_id: ID`
    * `payer: address`
    * `amount: u64`
* **`DebtCreated`**: Emitted when a new debt relationship is established or an existing one is increased.
    * `debtor: address`
    * `creditor: address`
    * `amount: u64`
    * `expense_id: ID`
* **`DebtPaid`**: Emitted when a debt is fully or partially paid.
    * `debtor: address`
    * `creditor: address`
    * `amount: u64`
* **`NetBalanceUpdated`**: Emitted when a member's credit or debit balance changes.
    * `group_id: ID`
    * `member: address`
    * `old_credit: u64`
    * `old_debit: u64`
    * `new_credit: u64`
    * `new_debit: u64`

### V. Entry Functions

These functions can be called by external users to interact with the contract.

#### 1. `create_group`

* **Description**: Creates a new expense-splitting group. The caller automatically becomes the owner and the first member.
* **Parameters**:
    * `name: vector<u8>`: The desired name for the group.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * A new `Group` shared object is created.
    * The caller is added as the initial member with zero balances.
    * The `Group` object is shared.
* **Errors**: None.

#### 2. `add_member`

* **Description**: Adds a new member to an existing group. Only the group owner can call this function.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `new_member: address`: The address of the member to add.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * `new_member` is added to `group.members`.
    * `new_member`'s initial balances (SUI, credits, debits) are initialized to zero in the group's tables.
    * A new entry for `new_member` is created in the `debt_matrix`.
* **Errors**:
    * `ENotGroupOwner`: If the caller is not the group owner.
    * `EAlreadyMember`: If `new_member` is already a member.

#### 3. `create_expense`

* **Description**: Records a new expense in the group and automatically calculates and tracks debts among participants based on equal shares. The payer of the expense must be a group member.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `description: vector<u8>`: A description of the expense.
    * `amount: u64`: The total amount of the expense.
    * `participants: vector<address>`: A list of members who are sharing this expense.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * A new `Expense` shared object is created.
    * The expense is added to `group.expenses`.
    * `group.total_expenses` is updated.
    * For each participant (excluding the payer), a debt is created or updated in the `debt_matrix` from the participant to the payer.
    * `member_credits` and `member_debits` are updated for affected members.
    * An `ExpenseCreated` event is emitted.
    * `DebtCreated` events are emitted for each new or updated debt.
* **Errors**:
    * `ENotGroupMember`: If the caller or any participant is not a group member.

#### 4. `settle_debt`

* **Description**: Allows a debtor to settle a specific outstanding debt to a creditor by providing SUI coins. This function directly affects the balances held within the group.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `creditor: address`: The address of the member who is owed money.
    * `payment: Coin<SUI>`: The SUI coin object used for payment.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * The `payment` SUI is added to the `creditor`'s `member_balances` within the group.
    * The debt between `debtor` (caller) and `creditor` in `debt_matrix` is reduced or cleared.
    * If `payment` exceeds `debt_amount`, a reverse debt is created from `creditor` to `debtor`.
    * `member_credits` and `member_debits` for both debtor and creditor are updated.
    * A `Settlement` shared object is created.
    * `group.total_settlements` is updated.
    * A `DebtPaid` event is emitted.
* **Errors**:
    * `ENotGroupMember`: If either `debtor` or `creditor` is not a group member.
    * `ESelfPayment`: If `debtor` and `creditor` are the same address.
    * `EDebtNotFound`: If no debt exists from `debtor` to `creditor`.

#### 5. `simplify_debts`

* **Description**: Implements a basic debt simplification algorithm to reduce the number of individual debt relationships within the group by canceling out mutual debts.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `_ctx: &mut TxContext`: Transaction context (currently unused but included for future extensibility).
* **Effects**:
    * Iterates through all pairs of members to identify and net off mutual debts (e.g., if A owes B $10 and B owes A $5, A will now owe B $5 and B owes A $0).
* **Errors**: None.

#### 6. `pay_member`

* **Description**: Facilitates a direct payment from one member to another, impacting the debt matrix and net balances. The SUI coin is directly transferred to the recipient.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `recipient: address`: The address of the member receiving the payment.
    * `payment: Coin<SUI>`: The SUI coin object to be transferred.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * The `payment` SUI coin is publicly transferred to the `recipient`.
    * If an outstanding debt exists from `sender` to `recipient`, it is reduced or cleared.
    * If the payment overpays an existing debt, a reverse debt is created from `recipient` to `sender`.
    * If no debt exists, a new debt from `recipient` to `sender` is created.
    * `member_credits` and `member_debits` for both sender and recipient are updated.
    * A `Settlement` shared object is created (if it settled a debt).
    * `group.total_settlements` is updated (if it settled a debt).
    * A `DebtPaid` event is emitted (if it settled a debt).
* **Errors**:
    * `ESelfPayment`: If `sender` and `recipient` are the same address.
    * `ENotGroupMember`: If either `sender` or `recipient` is not a group member.

#### 7. `withdraw_balance`

* **Description**: Allows a member to withdraw a specified amount of SUI from their in-group balance.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `amount: u64`: The amount of SUI to withdraw.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * The specified `amount` is split from the sender's `member_balances` and publicly transferred to the sender.
* **Errors**:
    * `ENotGroupMember`: If the caller is not a group member.
    * `EInsufficientFunds`: If the caller's balance is less than the requested `amount`.

#### 8. `withdraw_all`

* **Description**: Allows a member to withdraw all available SUI from their in-group balance.
* **Parameters**:
    * `group: &mut Group`: A mutable reference to the `Group` object.
    * `ctx: &mut TxContext`: Transaction context.
* **Effects**:
    * The entire balance is split from the sender's `member_balances` and publicly transferred to the sender.
* **Errors**:
    * `ENotGroupMember`: If the caller is not a group member.
    * `ENoBalanceToWithdraw`: If the caller has no balance to withdraw.

### VI. View Functions

These functions allow external parties to query the contract's state without requiring a transaction.

#### 1. `is_member`

* **Description**: Checks if an address is a member of the given group.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `addr: address`: The address to check.
* **Returns**: `bool` - `true` if `addr` is a member, `false` otherwise.

#### 2. `get_member_balance`

* **Description**: Retrieves the SUI balance held by a member within the group.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `member: address`: The address of the member.
* **Returns**: `u64` - The SUI amount in the member's in-group balance.

#### 3. `get_net_balance`

* **Description**: Calculates a member's net financial position within the group (credit minus debit).
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `member: address`: The address of the member.
* **Returns**: `(u64, u64, bool)`
    * `u64`: The absolute credit amount.
    * `u64`: The absolute debit amount.
    * `bool`: `true` if the member has a positive net balance (is owed money), `false` if they have a negative net balance (owe money).

#### 4. `get_debt_amount`

* **Description**: Retrieves the specific amount of money `debtor` owes to `creditor`.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `debtor: address`: The address of the potential debtor.
    * `creditor: address`: The address of the potential creditor.
* **Returns**: `u64` - The amount `debtor` owes `creditor`, or `0` if no such debt exists.

#### 5. `get_member_debts`

* **Description**: Retrieves a list of all members a given `debtor` owes money to, along with the respective amounts.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `debtor: address`: The address of the debtor.
* **Returns**: `(vector<address>, vector<u64>)` - A tuple where the first vector contains creditor addresses and the second vector contains the corresponding debt amounts.

#### 6. `get_member_credits`

* **Description**: Retrieves a list of all members who owe money to a given `creditor`, along with the respective amounts.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
    * `creditor: address`: The address of the creditor.
* **Returns**: `(vector<address>, vector<u64>)` - A tuple where the first vector contains debtor addresses and the second vector contains the corresponding credit amounts.

#### 7. `get_group_info`

* **Description**: Provides general information about a group.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
* **Returns**: `(vector<u8>, address, u64, u64)`
    * `vector<u8>`: The group's name.
    * `address`: The group owner's address.
    * `u64`: The total number of members in the group.
    * `u64`: The total expenses recorded in the group.

#### 8. `get_expense_info`

* **Description**: Provides information about a specific expense.
* **Parameters**:
    * `expense: &Expense`: An immutable reference to the `Expense` object.
* **Returns**: `(vector<u8>, address, u64, bool)`
    * `vector<u8>`: The expense description.
    * `address`: The payer's address.
    * `u64`: The total amount of the expense.
    * `bool`: `true` if the expense is marked as settled, `false` otherwise.

#### 9. `get_member_share`

* **Description**: Retrieves a specific member's allocated share for a given expense.
* **Parameters**:
    * `expense: &Expense`: An immutable reference to the `Expense` object.
    * `member: address`: The address of the member.
* **Returns**: `u64` - The member's share amount for that expense, or `0` if they are not a participant.

#### 10. `get_settlement_summary`

* **Description**: Provides a summary of financial activity within the group, including total expenses, total outstanding debt, and the number of active debt relationships.
* **Parameters**:
    * `group: &Group`: An immutable reference to the `Group` object.
* **Returns**: `(u64, u64, u64)`
    * `u64`: The total expenses in the group (`group.total_expenses`).
    * `u64`: The sum of all active, outstanding debts within the group.
    * `u64`: The number of active, outstanding debt relationships.

---