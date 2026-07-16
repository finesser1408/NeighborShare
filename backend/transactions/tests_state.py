import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from transactions.models import Transaction, TransactionState
from transactions.state import TransactionStateMachine, InvalidTransitionError, TRANSITIONS
from items.models import Item, Category
from users.models import User, UserProfile
from django.contrib.gis.geos import Point
import uuid

User = get_user_model()


class TransactionStateMachineTests(TestCase):
    def setUp(self):
        self.lender = User.objects.create_user(
            username='lender@example.com',
            email='lender@example.com',
            password='testpass123',
        )
        self.borrower = User.objects.create_user(
            username='borrower@example.com',
            email='borrower@example.com',
            password='testpass123',
        )
        UserProfile.objects.create(user=self.lender, is_active=True, national_id_verified=True)
        UserProfile.objects.create(user=self.borrower, is_active=True, national_id_verified=True)

        self.item = Item.objects.create(
            owner=self.lender,
            title='Test Drill',
            description='A power drill',
            category=Category.TOOLS,
            daily_rate_usd=5.00,
            deposit_amount_usd=50.00,
            location=Point(31.05, -17.7833, srid=4326),
        )

        self.transaction = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from='2024-01-10',
            requested_to='2024-01-15',
            deposit_amount=50.00,
            daily_rate=5.00,
        )

    def test_initial_state_is_pending(self):
        self.assertEqual(self.transaction.state, TransactionState.PENDING)

    def test_pending_to_accepted_allowed(self):
        machine = TransactionStateMachine(self.transaction)
        result = machine.accept(self.lender)
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.ACCEPTED)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.ACCEPTED)

    def test_pending_to_disputed_allowed(self):
        machine = TransactionStateMachine(self.transaction)
        result = machine.dispute(self.borrower, 'Changed mind')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DISPUTED)

    def test_accepted_to_deposit_held_allowed(self):
        self.transaction.state = TransactionState.ACCEPTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.hold_deposit(self.lender, 'EC123456')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DEPOSIT_HELD)
        self.assertEqual(self.transaction.escrow_reference, 'EC123456')

    def test_accepted_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ACCEPTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.dispute(self.borrower, 'Seller unresponsive')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DISPUTED)

    def test_deposit_held_to_item_out_allowed(self):
        self.transaction.state = TransactionState.DEPOSIT_HELD
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.handoff(self.lender)
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.ITEM_OUT)

    def test_deposit_held_to_disputed_allowed(self):
        self.transaction.state = TransactionState.DEPOSIT_HELD
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.dispute(self.borrower, 'Item not as described')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DISPUTED)

    def test_item_out_to_item_returned_allowed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.return_item(self.borrower)
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.ITEM_RETURNED)

    def test_item_out_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.dispute(self.lender, 'Item damaged')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DISPUTED)

    def test_item_returned_to_closed_allowed(self):
        self.transaction.state = TransactionState.ITEM_RETURNED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.close(self.lender)
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.CLOSED)

    def test_item_returned_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ITEM_RETURNED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.dispute(self.borrower, 'Deposit not released')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.DISPUTED)

    def test_disputed_to_closed_allowed(self):
        self.transaction.state = TransactionState.DISPUTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        result = machine.resolve_dispute(self.lender, 'split')
        self.assertTrue(result.success)
        self.assertEqual(result.new_state, TransactionState.CLOSED)

    def test_closed_no_transitions_allowed(self):
        self.transaction.state = TransactionState.CLOSED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        for state in TransactionState:
            if state != TransactionState.CLOSED:
                with self.assertRaises(InvalidTransitionError):
                    machine.transition(state, self.lender)

    def test_invalid_transition_pending_to_item_out(self):
        machine = TransactionStateMachine(self.transaction)
        with self.assertRaises(InvalidTransitionError):
            machine.transition(TransactionState.ITEM_OUT, self.lender)

    def test_invalid_transition_accepted_to_item_out(self):
        self.transaction.state = TransactionState.ACCEPTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        with self.assertRaises(InvalidTransitionError):
            machine.transition(TransactionState.ITEM_OUT, self.lender)

    def test_invalid_transition_deposit_held_to_closed(self):
        self.transaction.state = TransactionState.DEPOSIT_HELD
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        with self.assertRaises(InvalidTransitionError):
            machine.transition(TransactionState.CLOSED, self.lender)

    def test_invalid_transition_item_out_to_closed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        with self.assertRaises(InvalidTransitionError):
            machine.transition(TransactionState.CLOSED, self.lender)

    def test_invalid_transition_disputed_to_item_out(self):
        self.transaction.state = TransactionState.DISPUTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        with self.assertRaises(InvalidTransitionError):
            machine.transition(TransactionState.ITEM_OUT, self.lender)

    def test_transition_creates_event(self):
        machine = TransactionStateMachine(self.transaction)
        machine.accept(self.lender)
        events = self.transaction.events.all()
        self.assertEqual(events.count(), 1)
        event = events.first()
        self.assertEqual(event.event_type, 'STATE_CHANGE')
        self.assertEqual(event.detail['from_state'], 'PENDING')
        self.assertEqual(event.detail['to_state'], 'ACCEPTED')

    def test_transition_logs_correctly(self):
        import logging
        logger = logging.getLogger('transactions.state')
        with self.assertLogs(logger, level='INFO') as cm:
            machine = TransactionStateMachine(self.transaction)
            machine.accept(self.lender)
        self.assertTrue(any('PENDING -> ACCEPTED' in msg for msg in cm.output))

    def test_can_transition_method(self):
        machine = TransactionStateMachine(self.transaction)
        self.assertTrue(machine.can_transition(TransactionState.ACCEPTED))
        self.assertTrue(machine.can_transition(TransactionState.DISPUTED))
        self.assertFalse(machine.can_transition(TransactionState.ITEM_OUT))
        self.assertFalse(machine.can_transition(TransactionState.CLOSED))

    def test_all_valid_transitions_defined(self):
        for from_state, to_states in TRANSITIONS.items():
            self.assertIn(from_state, TransactionState)
            for to_state in to_states:
                self.assertIn(to_state, TransactionState)

    def test_no_transitions_from_closed(self):
        self.assertEqual(TRANSITIONS[TransactionState.CLOSED], [])

    def test_disputed_can_only_go_to_closed(self):
        self.assertEqual(TRANSITIONS[TransactionState.DISPUTED], [TransactionState.CLOSED])