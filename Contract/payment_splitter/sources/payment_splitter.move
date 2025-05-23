module payment_splitter::payment_splitter {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;

    /// Error codes
    const ENotGroupMember: u64 = 1;
    const EAlreadyMember: u64 = 2;
    const EInsufficientFunds: u64 = 3;
    const ENoBalanceToWithdraw: u64 = 6;
    const ENotGroupOwner: u64 = 7;
    const ESelfPayment: u64 = 8;
    const EDebtNotFound: u64 = 11;

    /// Group struct that manages members, expenses, and debts
    public struct Group has key, store {
        id: UID,
        name: vector<u8>,
        owner: address,
        members: vector<address>,
        expenses: vector<ID>,
        member_balances: Table<address, Balance<SUI>>,
        // Track what each member is owed (positive values only)
        member_credits: Table<address, u64>,
        // Track what each member owes (positive values only)
        member_debits: Table<address, u64>,
        // Track all debts: debtor -> creditor -> amount
        debt_matrix: Table<address, Table<address, u64>>,
        total_expenses: u64,
        total_settlements: u64,
    }

    /// Expense struct representing a shared expense
    public struct Expense has key, store {
        id: UID,
        group_id: ID,
        description: vector<u8>,
        payer: address,
        amount: u64,
        participants: vector<address>,
        shares: Table<address, u64>, // address -> share amount
        settled: bool,
        timestamp: u64,
    }

    /// Debt record for tracking who owes whom
    public struct Debt has store, drop {
        debtor: address,
        creditor: address,
        amount: u64,
        expense_id: ID,
        paid: bool,
    }

    /// Settlement record for payment history
    public struct Settlement has key, store {
        id: UID,
        group_id: ID,
        from: address,
        to: address,
        amount: u64,
        timestamp: u64,
        note: vector<u8>,
    }

    /// Events
    public struct ExpenseCreated has copy, drop {
        expense_id: ID,
        group_id: ID,
        payer: address,
        amount: u64,
    }

    public struct DebtCreated has copy, drop {
        debtor: address,
        creditor: address,
        amount: u64,
        expense_id: ID,
    }

    public struct DebtPaid has copy, drop {
        debtor: address,
        creditor: address,
        amount: u64,
    }

    public struct NetBalanceUpdated has copy, drop {
        group_id: ID,
        member: address,
        old_credit: u64,
        old_debit: u64,
        new_credit: u64,
        new_debit: u64,
    }

    /// Create a new group
    public entry fun create_group(
        name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let mut group = Group {
            id: object::new(ctx),
            name,
            owner: sender,
            members: vector::empty(),
            expenses: vector::empty(),
            member_balances: table::new(ctx),
            member_credits: table::new(ctx),
            member_debits: table::new(ctx),
            debt_matrix: table::new(ctx),
            total_expenses: 0,
            total_settlements: 0,
        };
        
        // Add creator as first member
        vector::push_back(&mut group.members, sender);
        table::add(&mut group.member_balances, sender, balance::zero<SUI>());
        table::add(&mut group.member_credits, sender, 0);
        table::add(&mut group.member_debits, sender, 0);
        table::add(&mut group.debt_matrix, sender, table::new(ctx));
        
        transfer::share_object(group);
    }

    /// Add a member to the group
    public entry fun add_member(
        group: &mut Group,
        new_member: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == group.owner, ENotGroupOwner);
        assert!(!vector::contains(&group.members, &new_member), EAlreadyMember);
        
        vector::push_back(&mut group.members, new_member);
        table::add(&mut group.member_balances, new_member, balance::zero<SUI>());
        table::add(&mut group.member_credits, new_member, 0);
        table::add(&mut group.member_debits, new_member, 0);
        table::add(&mut group.debt_matrix, new_member, table::new(ctx));
    }

    /// Create an expense with automatic debt tracking (no upfront payment required)
    public entry fun create_expense(
        group: &mut Group,
        description: vector<u8>,
        amount: u64,
        participants: vector<address>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_member(group, sender), ENotGroupMember);
        
        // Verify all participants are members
        let mut i = 0;
        while (i < vector::length(&participants)) {
            assert!(is_member(group, *vector::borrow(&participants, i)), ENotGroupMember);
            i = i + 1;
        };
        
        let share_per_person = amount / vector::length(&participants);
        
        // Create expense
        let expense_id = object::new(ctx);
        let expense_id_copy = object::uid_to_inner(&expense_id);
        
        let mut expense = Expense {
            id: expense_id,
            group_id: object::uid_to_inner(&group.id),
            description,
            payer: sender,
            amount,
            participants,
            shares: table::new(ctx),
            settled: false,
            timestamp: tx_context::epoch(ctx),
        };
        
        // Calculate shares and create debts
        let mut i = 0;
        let mut total_allocated = 0;
        while (i < vector::length(&participants)) {
            let participant = *vector::borrow(&participants, i);
            let share = if (i == vector::length(&participants) - 1) {
                amount - total_allocated
            } else {
                share_per_person
            };
            table::add(&mut expense.shares, participant, share);
            total_allocated = total_allocated + share;
            
            // Create debt if participant is not the payer
            if (participant != sender) {
                create_or_update_debt(group, participant, sender, share, expense_id_copy, ctx);
                
                // Update net balances
                update_member_debit(group, participant, share, true);
                update_member_credit(group, sender, share, true);
            };
            
            i = i + 1;
        };
        
        // Update group
        vector::push_back(&mut group.expenses, expense_id_copy);
        group.total_expenses = group.total_expenses + amount;
        
        // Emit event
        event::emit(ExpenseCreated {
            expense_id: expense_id_copy,
            group_id: object::uid_to_inner(&group.id),
            payer: sender,
            amount,
        });
        
        transfer::share_object(expense);
    }

    /// Settle a specific debt between two members
    public entry fun settle_debt(
        group: &mut Group,
        creditor: address,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let debtor = tx_context::sender(ctx);
        assert!(is_member(group, debtor), ENotGroupMember);
        assert!(is_member(group, creditor), ENotGroupMember);
        assert!(debtor != creditor, ESelfPayment);
        
        let amount = coin::value(&payment);
        let debt_amount = get_debt_amount(group, debtor, creditor);
        assert!(debt_amount > 0, EDebtNotFound);
        
        // Add payment to creditor's balance
        let creditor_balance = table::borrow_mut(&mut group.member_balances, creditor);
        balance::join(creditor_balance, coin::into_balance(payment));
        
        // Update debt
        let remaining_debt = if (amount >= debt_amount) {
            // Full payment or overpayment
            clear_debt(group, debtor, creditor);
            
            // If overpayment, create reverse debt
            if (amount > debt_amount) {
                let overpayment = amount - debt_amount;
                create_or_update_debt(group, creditor, debtor, overpayment, object::id_from_address(@0x0), ctx);
                update_member_debit(group, creditor, overpayment, true);
                update_member_credit(group, debtor, overpayment, true);
            };
            0
        } else {
            // Partial payment
            update_debt_amount(group, debtor, creditor, debt_amount - amount);
            debt_amount - amount
        };
        
        // Update net balances
        let payment_effect = if (amount > debt_amount) { debt_amount } else { amount };
        update_member_debit(group, debtor, payment_effect, false);
        update_member_credit(group, creditor, payment_effect, false);
        
        // Create settlement record
        let settlement = Settlement {
            id: object::new(ctx),
            group_id: object::uid_to_inner(&group.id),
            from: debtor,
            to: creditor,
            amount,
            timestamp: tx_context::epoch(ctx),
            note: b"Debt settlement",
        };
        
        group.total_settlements = group.total_settlements + amount;
        
        // Emit event
        event::emit(DebtPaid {
            debtor,
            creditor,
            amount,
        });
        
        transfer::share_object(settlement);
    }

    /// Simplify debts using debt simplification algorithm
    public entry fun simplify_debts(
        group: &mut Group,
        _ctx: &mut TxContext
    ) {
        // This is a complex operation that would require significant computation
        // For now, we'll implement a basic version that clears circular debts
        
        let mut i = 0;
        while (i < vector::length(&group.members)) {
            let member1 = *vector::borrow(&group.members, i);
            let mut j = i + 1;
            while (j < vector::length(&group.members)) {
                let member2 = *vector::borrow(&group.members, j);
                
                let debt1to2 = get_debt_amount(group, member1, member2);
                let debt2to1 = get_debt_amount(group, member2, member1);
                
                if (debt1to2 > 0 && debt2to1 > 0) {
                    // Cancel out mutual debts
                    if (debt1to2 > debt2to1) {
                        clear_debt(group, member2, member1);
                        update_debt_amount(group, member1, member2, debt1to2 - debt2to1);
                    } else if (debt2to1 > debt1to2) {
                        clear_debt(group, member1, member2);
                        update_debt_amount(group, member2, member1, debt2to1 - debt1to2);
                    } else {
                        // Equal debts, clear both
                        clear_debt(group, member1, member2);
                        clear_debt(group, member2, member1);
                    };
                };
                
                j = j + 1;
            };
            i = i + 1;
        };
    }

    /// Direct payment from one member to another with proper debt clearing
    public entry fun pay_member(
        group: &mut Group,
        recipient: address,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender != recipient, ESelfPayment);
        assert!(is_member(group, sender), ENotGroupMember);
        assert!(is_member(group, recipient), ENotGroupMember);
        
        let amount = coin::value(&payment);
        
        // Transfer the payment directly to the recipient
        transfer::public_transfer(payment, recipient);
        
        // Check if this payment is for an existing debt
        let debt_amount = get_debt_amount(group, sender, recipient);
        if (debt_amount > 0) {
            // Apply payment to debt
            let payment_to_debt = if (amount >= debt_amount) {
                // Full payment or overpayment
                clear_debt(group, sender, recipient);
                update_member_debit(group, sender, debt_amount, false);
                update_member_credit(group, recipient, debt_amount, false);
                
                if (amount > debt_amount) {
                    // Overpayment creates reverse debt
                    let overpayment = amount - debt_amount;
                    create_or_update_debt(group, recipient, sender, overpayment, object::id_from_address(@0x0), ctx);
                    update_member_debit(group, recipient, overpayment, true);
                    update_member_credit(group, sender, overpayment, true);
                };
                debt_amount
            } else {
                // Partial payment
                update_debt_amount(group, sender, recipient, debt_amount - amount);
                update_member_debit(group, sender, amount, false);
                update_member_credit(group, recipient, amount, false);
                amount
            };
            
            // Create settlement record
            let settlement = Settlement {
                id: object::new(ctx),
                group_id: object::uid_to_inner(&group.id),
                from: sender,
                to: recipient,
                amount: payment_to_debt,
                timestamp: tx_context::epoch(ctx),
                note: b"Debt settlement via pay_member",
            };
            
            group.total_settlements = group.total_settlements + payment_to_debt;
            
            // Emit debt paid event
            event::emit(DebtPaid {
                debtor: sender,
                creditor: recipient,
                amount: payment_to_debt,
            });
            
            transfer::share_object(settlement);
        } else {
            // No existing debt, create new debt from recipient to sender
            create_or_update_debt(group, recipient, sender, amount, object::id_from_address(@0x0), ctx);
            update_member_debit(group, recipient, amount, true);
            update_member_credit(group, sender, amount, true);
        };
    }

    /// Withdraw funds from your balance in the group
    public entry fun withdraw_balance(
        group: &mut Group,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_member(group, sender), ENotGroupMember);
        
        let member_balance = table::borrow_mut(&mut group.member_balances, sender);
        assert!(balance::value(member_balance) >= amount, EInsufficientFunds);
        
        let withdrawn = coin::from_balance(balance::split(member_balance, amount), ctx);
        transfer::public_transfer(withdrawn, sender);
    }

    /// Withdraw all funds from your balance
    public entry fun withdraw_all(
        group: &mut Group,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_member(group, sender), ENotGroupMember);
        
        let member_balance = table::borrow_mut(&mut group.member_balances, sender);
        let amount = balance::value(member_balance);
        assert!(amount > 0, ENoBalanceToWithdraw);
        
        let withdrawn = coin::from_balance(balance::split(member_balance, amount), ctx);
        transfer::public_transfer(withdrawn, sender);
    }

    // === Helper Functions ===

    fun create_or_update_debt(
        group: &mut Group,
        debtor: address,
        creditor: address,
        amount: u64,
        expense_id: ID,
        _ctx: &mut TxContext
    ) {
        let debtor_table = table::borrow_mut(&mut group.debt_matrix, debtor);
        
        if (table::contains(debtor_table, creditor)) {
            let current_debt = table::remove(debtor_table, creditor);
            table::add(debtor_table, creditor, current_debt + amount);
        } else {
            table::add(debtor_table, creditor, amount);
        };
        
        event::emit(DebtCreated {
            debtor,
            creditor,
            amount,
            expense_id,
        });
    }

    fun update_debt_amount(
        group: &mut Group,
        debtor: address,
        creditor: address,
        new_amount: u64
    ) {
        let debtor_table = table::borrow_mut(&mut group.debt_matrix, debtor);
        if (table::contains(debtor_table, creditor)) {
            table::remove(debtor_table, creditor);
            if (new_amount > 0) {
                table::add(debtor_table, creditor, new_amount);
            };
        };
    }

    fun clear_debt(
        group: &mut Group,
        debtor: address,
        creditor: address
    ) {
        let debtor_table = table::borrow_mut(&mut group.debt_matrix, debtor);
        if (table::contains(debtor_table, creditor)) {
            table::remove(debtor_table, creditor);
        };
    }

    fun update_member_credit(
        group: &mut Group,
        member: address,
        amount: u64,
        increase: bool
    ) {
        let old_credit = *table::borrow(&group.member_credits, member);
        let old_debit = *table::borrow(&group.member_debits, member);
        
        let new_credit = if (increase) {
            old_credit + amount
        } else {
            if (old_credit >= amount) { old_credit - amount } else { 0 }
        };
        
        table::remove(&mut group.member_credits, member);
        table::add(&mut group.member_credits, member, new_credit);
        
        event::emit(NetBalanceUpdated {
            group_id: object::uid_to_inner(&group.id),
            member,
            old_credit,
            old_debit,
            new_credit,
            new_debit: old_debit,
        });
    }

    fun update_member_debit(
        group: &mut Group,
        member: address,
        amount: u64,
        increase: bool
    ) {
        let old_credit = *table::borrow(&group.member_credits, member);
        let old_debit = *table::borrow(&group.member_debits, member);
        
        let new_debit = if (increase) {
            old_debit + amount
        } else {
            if (old_debit >= amount) { old_debit - amount } else { 0 }
        };
        
        table::remove(&mut group.member_debits, member);
        table::add(&mut group.member_debits, member, new_debit);
        
        event::emit(NetBalanceUpdated {
            group_id: object::uid_to_inner(&group.id),
            member,
            old_credit,
            old_debit,
            new_credit: old_credit,
            new_debit,
        });
    }

    // === View Functions ===

    /// Check if an address is a member of the group
    public fun is_member(group: &Group, addr: address): bool {
        vector::contains(&group.members, &addr)
    }

    /// Get member's balance in the group
    public fun get_member_balance(group: &Group, member: address): u64 {
        if (table::contains(&group.member_balances, member)) {
            balance::value(table::borrow(&group.member_balances, member))
        } else {
            0
        }
    }

    /// Get member's net balance (credit - debit)
    public fun get_net_balance(group: &Group, member: address): (u64, u64, bool) {
        let credit = if (table::contains(&group.member_credits, member)) {
            *table::borrow(&group.member_credits, member)
        } else {
            0
        };
        
        let debit = if (table::contains(&group.member_debits, member)) {
            *table::borrow(&group.member_debits, member)
        } else {
            0
        };
        
        if (credit >= debit) {
            (credit - debit, 0, true) // positive balance (owed money)
        } else {
            (0, debit - credit, false) // negative balance (owes money)
        }
    }

    /// Get debt amount between two members
    public fun get_debt_amount(group: &Group, debtor: address, creditor: address): u64 {
        if (table::contains(&group.debt_matrix, debtor)) {
            let debtor_table = table::borrow(&group.debt_matrix, debtor);
            if (table::contains(debtor_table, creditor)) {
                *table::borrow(debtor_table, creditor)
            } else {
                0
            }
        } else {
            0
        }
    }

    /// Get all debts for a member (returns list of creditors and amounts)
    public fun get_member_debts(group: &Group, debtor: address): (vector<address>, vector<u64>) {
        let mut creditors = vector::empty<address>();
        let mut amounts = vector::empty<u64>();
        
        if (table::contains(&group.debt_matrix, debtor)) {
            let debtor_table = table::borrow(&group.debt_matrix, debtor);
            let mut i = 0;
            while (i < vector::length(&group.members)) {
                let creditor = *vector::borrow(&group.members, i);
                if (table::contains(debtor_table, creditor)) {
                    let amount = *table::borrow(debtor_table, creditor);
                    if (amount > 0) {
                        vector::push_back(&mut creditors, creditor);
                        vector::push_back(&mut amounts, amount);
                    };
                };
                i = i + 1;
            };
        };
        
        (creditors, amounts)
    }

    /// Get all credits for a member (who owes them money)
    public fun get_member_credits(group: &Group, creditor: address): (vector<address>, vector<u64>) {
        let mut debtors = vector::empty<address>();
        let mut amounts = vector::empty<u64>();
        
        let mut i = 0;
        while (i < vector::length(&group.members)) {
            let debtor = *vector::borrow(&group.members, i);
            let debt_amount = get_debt_amount(group, debtor, creditor);
            if (debt_amount > 0) {
                vector::push_back(&mut debtors, debtor);
                vector::push_back(&mut amounts, debt_amount);
            };
            i = i + 1;
        };
        
        (debtors, amounts)
    }

    /// Get group info
    public fun get_group_info(group: &Group): (vector<u8>, address, u64, u64) {
        (
            group.name,
            group.owner,
            vector::length(&group.members),
            group.total_expenses
        )
    }

    /// Get expense info
    public fun get_expense_info(expense: &Expense): (vector<u8>, address, u64, bool) {
        (
            expense.description,
            expense.payer,
            expense.amount,
            expense.settled
        )
    }

    /// Get member's share in an expense
    public fun get_member_share(expense: &Expense, member: address): u64 {
        if (table::contains(&expense.shares, member)) {
            *table::borrow(&expense.shares, member)
        } else {
            0
        }
    }

    /// Get settlement summary for the group
    public fun get_settlement_summary(group: &Group): (u64, u64, u64) {
        let mut total_debt = 0u64;
        let mut active_debts = 0u64;
        
        let mut i = 0;
        while (i < vector::length(&group.members)) {
            let member = *vector::borrow(&group.members, i);
            let (_, amounts) = get_member_debts(group, member);
            let mut j = 0;
            while (j < vector::length(&amounts)) {
                total_debt = total_debt + *vector::borrow(&amounts, j);
                active_debts = active_debts + 1;
                j = j + 1;
            };
            i = i + 1;
        };
        
        (group.total_expenses, total_debt, active_debts)
    }
}