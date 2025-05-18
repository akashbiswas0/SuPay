#[test_only]
module payment_splitter::payment_splitter_tests {
    use sui::test_scenario::{Self, Scenario};
    use sui::coin;
    use sui::sui::SUI;
    use payment_splitter::payment_splitter::{Self, Group};

    // Test addresses
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC4A211E;

    fun setup_scenario(): Scenario {
        test_scenario::begin(ALICE)
    }

    #[test]
    fun test_create_group() {
        let mut scenario = setup_scenario();
        
        // Alice creates a group
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Test Group", test_scenario::ctx(&mut scenario));
        };
        
        // Verify group was created
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let group = test_scenario::take_shared<Group>(&scenario);
            let (name, owner, member_count, total_expenses) = payment_splitter::get_group_info(&group);
            
            assert!(name == b"Test Group", 0);
            assert!(owner == ALICE, 1);
            assert!(member_count == 1, 2);
            assert!(total_expenses == 0, 3);
            assert!(payment_splitter::is_member(&group, ALICE), 4);
            
            let (net_amount, _, is_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(net_amount == 0 && is_positive, 5);
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_expense_creates_debts() {
        let mut scenario = setup_scenario();
        
        // Setup group with members
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Debt Test", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            payment_splitter::add_member(&mut group, CHARLIE, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Alice pays for dinner (300 SUI split among 3)
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(300, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            vector::push_back(&mut participants, CHARLIE);
            
            payment_splitter::create_expense(
                &mut group,
                b"Dinner",
                payment,
                participants,
                test_scenario::ctx(&mut scenario)
            );
            
            // Check debts were created
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 100, 0);
            assert!(payment_splitter::get_debt_amount(&group, CHARLIE, ALICE) == 100, 1);
            
            // Check net balances
            let (alice_net, _, alice_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(alice_net == 200 && alice_positive, 2); // Owed 200
            
            let (_, bob_debt, bob_positive) = payment_splitter::get_net_balance(&group, BOB);
            assert!(bob_debt == 100 && !bob_positive, 3); // Owes 100
            
            let (_, charlie_debt, charlie_positive) = payment_splitter::get_net_balance(&group, CHARLIE);
            assert!(charlie_debt == 100 && !charlie_positive, 4); // Owes 100
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_settle_debt() {
        let mut scenario = setup_scenario();
        
        // Setup group and create expense
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Settlement Test", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Alice pays for lunch (200 SUI split between Alice and Bob)
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(200, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            
            payment_splitter::create_expense(
                &mut group,
                b"Lunch",
                payment,
                participants,
                test_scenario::ctx(&mut scenario)
            );
            
            // Bob owes Alice 100
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 100, 0);
            
            test_scenario::return_shared(group);
        };
        
        // Bob settles his debt
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(100, test_scenario::ctx(&mut scenario));
            
            payment_splitter::settle_debt(
                &mut group,
                ALICE,
                payment,
                test_scenario::ctx(&mut scenario)
            );
            
            // Debt should be cleared
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 0, 1);
            
            // Net balances should be zero
            let (alice_net, alice_debt, alice_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(alice_net == 0 && alice_debt == 0, 2);
            
            let (bob_net, bob_debt, bob_positive) = payment_splitter::get_net_balance(&group, BOB);
            assert!(bob_net == 0 && bob_debt == 0, 3);
            
            // Alice should have received the payment
            assert!(payment_splitter::get_member_balance(&group, ALICE) == 300, 4); // 200 from expense + 100 from Bob
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_partial_debt_settlement() {
        let mut scenario = setup_scenario();
        
        // Setup
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Partial Settlement", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Create expense where Bob owes Alice 100
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(200, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            
            payment_splitter::create_expense(&mut group, b"Dinner", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Bob pays 60 (partial payment)
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(60, test_scenario::ctx(&mut scenario));
            
            payment_splitter::settle_debt(&mut group, ALICE, payment, test_scenario::ctx(&mut scenario));
            
            // Bob should still owe 40
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 40, 0);
            
            let (_, bob_debt, bob_positive) = payment_splitter::get_net_balance(&group, BOB);
            assert!(bob_debt == 40 && !bob_positive, 1);
            
            let (alice_net, _, alice_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(alice_net == 40 && alice_positive, 2);
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_overpayment_creates_reverse_debt() {
        let mut scenario = setup_scenario();
        
        // Setup
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Overpayment Test", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Create expense where Bob owes Alice 100
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(200, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            
            payment_splitter::create_expense(&mut group, b"Lunch", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Bob pays 150 (overpayment by 50)
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(150, test_scenario::ctx(&mut scenario));
            
            payment_splitter::settle_debt(&mut group, ALICE, payment, test_scenario::ctx(&mut scenario));
            
            // Bob's debt to Alice should be cleared
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 0, 0);
            
            // Alice should now owe Bob 50
            assert!(payment_splitter::get_debt_amount(&group, ALICE, BOB) == 50, 1);
            
            // Net balances should reflect this
            let (_, alice_debt, alice_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(alice_debt == 50 && !alice_positive, 2);
            
            let (bob_net, _, bob_positive) = payment_splitter::get_net_balance(&group, BOB);
            assert!(bob_net == 50 && bob_positive, 3);
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_complex_debt_scenario() {
        let mut scenario = setup_scenario();
        
        // Setup group with 3 members
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Complex Debts", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            payment_splitter::add_member(&mut group, CHARLIE, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Expense 1: Alice pays 300 for all three (each owes 100)
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(300, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            vector::push_back(&mut participants, CHARLIE);
            
            payment_splitter::create_expense(&mut group, b"Hotel", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Expense 2: Bob pays 150 for Bob and Charlie only (Charlie owes Bob 75)
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(150, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, BOB);
            vector::push_back(&mut participants, CHARLIE);
            
            payment_splitter::create_expense(&mut group, b"Rental Car", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Check final debt state
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let group = test_scenario::take_shared<Group>(&scenario);
            
            // Bob owes Alice 100
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 100, 0);
            
            // Charlie owes Alice 100 and Bob 75
            assert!(payment_splitter::get_debt_amount(&group, CHARLIE, ALICE) == 100, 1);
            assert!(payment_splitter::get_debt_amount(&group, CHARLIE, BOB) == 75, 2);
            
            // Net balances
            let (alice_net, _, alice_positive) = payment_splitter::get_net_balance(&group, ALICE);
            assert!(alice_net == 200 && alice_positive, 3); // Owed 200
            
            let (bob_net, bob_debt, bob_positive) = payment_splitter::get_net_balance(&group, BOB);
            assert!(bob_debt == 25 && !bob_positive, 4); // Owes 100, owed 75 = net owes 25
            
            let (_, charlie_debt, charlie_positive) = payment_splitter::get_net_balance(&group, CHARLIE);
            assert!(charlie_debt == 175 && !charlie_positive, 5); // Owes 175
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_get_member_debts_and_credits() {
        let mut scenario = setup_scenario();
        
        // Setup group
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Debt Tracking", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            payment_splitter::add_member(&mut group, CHARLIE, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Create multiple expenses
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(300, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            vector::push_back(&mut participants, CHARLIE);
            
            payment_splitter::create_expense(&mut group, b"Dinner", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Check debts and credits
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let group = test_scenario::take_shared<Group>(&scenario);
            
            // Alice's credits (who owes her)
            let (debtors, _amounts) = payment_splitter::get_member_credits(&group, ALICE);
            assert!(vector::length(&debtors) == 2, 0);
            
            let bob_copy = BOB;
            let charlie_copy = CHARLIE;
            assert!(vector::contains(&debtors, &bob_copy), 1);
            assert!(vector::contains(&debtors, &charlie_copy), 2);
            
            // Bob's debts (who he owes)
            let (creditors, amounts) = payment_splitter::get_member_debts(&group, BOB);
            assert!(vector::length(&creditors) == 1, 3);
            assert!(*vector::borrow(&creditors, 0) == ALICE, 4);
            assert!(*vector::borrow(&amounts, 0) == 100, 5);
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_simplify_debts() {
        let mut scenario = setup_scenario();
        
        // Setup group
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Simplify Test", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Create circular debts
        // Alice pays 100 for both
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(100, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            
            payment_splitter::create_expense(&mut group, b"Lunch", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Bob pays 80 for both
        test_scenario::next_tx(&mut scenario, BOB);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(80, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            
            payment_splitter::create_expense(&mut group, b"Coffee", payment, participants, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Before simplification: Bob owes Alice 50, Alice owes Bob 40
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 50, 0);
            assert!(payment_splitter::get_debt_amount(&group, ALICE, BOB) == 40, 1);
            
            // Simplify debts
            payment_splitter::simplify_debts(&mut group, test_scenario::ctx(&mut scenario));
            
            // After simplification: Only Bob owes Alice 10
            assert!(payment_splitter::get_debt_amount(&group, BOB, ALICE) == 10, 2);
            assert!(payment_splitter::get_debt_amount(&group, ALICE, BOB) == 0, 3);
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }

    #[test]
    fun test_settlement_summary() {
        let mut scenario = setup_scenario();
        
        // Setup and create expenses
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            payment_splitter::create_group(b"Summary Test", test_scenario::ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            payment_splitter::add_member(&mut group, BOB, test_scenario::ctx(&mut scenario));
            payment_splitter::add_member(&mut group, CHARLIE, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(group);
        };
        
        // Create expenses
        test_scenario::next_tx(&mut scenario, ALICE);
        {
            let mut group = test_scenario::take_shared<Group>(&scenario);
            let payment = coin::mint_for_testing<SUI>(600, test_scenario::ctx(&mut scenario));
            let mut participants = vector::empty<address>();
            vector::push_back(&mut participants, ALICE);
            vector::push_back(&mut participants, BOB);
            vector::push_back(&mut participants, CHARLIE);
            
            payment_splitter::create_expense(&mut group, b"Weekend Trip", payment, participants, test_scenario::ctx(&mut scenario));
            
            // Check summary
            let (total_expenses, total_debt, active_debts) = payment_splitter::get_settlement_summary(&group);
            assert!(total_expenses == 600, 0);
            assert!(total_debt == 400, 1); // Bob owes 200 + Charlie owes 200
            assert!(active_debts == 2, 2); // 2 active debt relationships
            
            test_scenario::return_shared(group);
        };
        
        test_scenario::end(scenario);
    }
}