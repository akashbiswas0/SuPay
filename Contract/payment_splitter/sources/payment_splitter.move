module payment_splitter::payment_splitter {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};

    /// Error codes
    const ENotGroupMember: u64 = 1;
    const EAlreadyMember: u64 = 2;
    const EInsufficientFunds: u64 = 3;
    const ENotExpensePayer: u64 = 5;
    const EExpenseAlreadySettled: u64 = 6;
    const ENoBalanceToWithdraw: u64 = 7;
    const ENotGroupOwner: u64 = 8;
    const ESelfPayment: u64 = 9;

    /// Group struct that manages members and expenses
    public struct Group has key, store {
        id: UID,
        name: vector<u8>,
        owner: address,
        members: vector<address>,
        expenses: vector<ID>,
        member_balances: Table<address, Balance<SUI>>,
        total_expenses: u64,
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
            total_expenses: 0,
        };
        
        // Add creator as first member
        vector::push_back(&mut group.members, sender);
        table::add(&mut group.member_balances, sender, balance::zero<SUI>());
        
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
    }

    /// Create and pay for an expense
    public entry fun create_expense(
        group: &mut Group,
        description: vector<u8>,
        payment: Coin<SUI>,
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
        
        let amount = coin::value(&payment);
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
            participants: participants,
            shares: table::new(ctx),
            settled: false,
        };
        
        // Calculate shares
        let mut i = 0;
        let mut total_allocated = 0;
        while (i < vector::length(&participants)) {
            let participant = *vector::borrow(&participants, i);
            let share = if (i == vector::length(&participants) - 1) {
                // Last person gets remainder to handle rounding
                amount - total_allocated
            } else {
                share_per_person
            };
            table::add(&mut expense.shares, participant, share);
            total_allocated = total_allocated + share;
            i = i + 1;
        };
        
        // Add payment to payer's balance
        let payer_balance = table::borrow_mut(&mut group.member_balances, sender);
        balance::join(payer_balance, coin::into_balance(payment));
        
        // Update group
        vector::push_back(&mut group.expenses, expense_id_copy);
        group.total_expenses = group.total_expenses + amount;
        
        transfer::share_object(expense);
    }

    /// Settle an expense by distributing funds to participants
    public entry fun settle_expense(
        group: &mut Group,
        expense: &mut Expense,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == expense.payer, ENotExpensePayer);
        assert!(!expense.settled, EExpenseAlreadySettled);
        
        // Distribute funds to each participant's balance
        let mut i = 0;
        while (i < vector::length(&expense.participants)) {
            let participant = *vector::borrow(&expense.participants, i);
            if (participant != expense.payer) {
                let share = *table::borrow(&expense.shares, participant);
                
                // Get payer balance, take share, then get participant balance
                let payer_balance = table::borrow_mut(&mut group.member_balances, expense.payer);
                
                // Check if payer has sufficient balance
                assert!(balance::value(payer_balance) >= share, EInsufficientFunds);
                
                // Transfer share from payer to participant
                let share_balance = balance::split(payer_balance, share);
                
                // Now get participant balance (after we're done with payer_balance)
                let participant_balance = table::borrow_mut(&mut group.member_balances, participant);
                balance::join(participant_balance, share_balance);
            };
            i = i + 1;
        };
        
        expense.settled = true;
    }

    /// Direct payment from one member to another
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
        
        let recipient_balance = table::borrow_mut(&mut group.member_balances, recipient);
        balance::join(recipient_balance, coin::into_balance(payment));
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
}