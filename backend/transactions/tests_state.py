import pytest
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from transactions.models import Transaction, TransactionState
from transactions.state import TransactionStateMachine, InvalidTransitionError
from items.models import Item, Category
from users.models import User, UserProfile
from django.contrib.gis.geos import Point

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
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
            time_credits_per_day=5,
            location=Point(31.05, -17.7833, srid=4326),
        )

        self.transaction = Transaction.objects.create(
            borrower=self.borrower,
            item=self.item,
            state=TransactionState.PENDING,
            requested_from='2024-01-10',
            requested_to='2024-01-15',
            time_credits_per_day=5,
            total_time_credits=30,
        )

    def test_initial_state_is_pending(self):
        self.assertEqual(self.transaction.state, TransactionState.PENDING)

    def test_pending_to_agreed_allowed(self):
        machine = TransactionStateMachine(self.transaction)
        machine.accept(self.lender)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.AGREED)

    def test_pending_to_disputed_allowed(self):
        machine = TransactionStateMachine(self.transaction)
        machine.dispute(self.borrower, 'Changed mind')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.DISPUTED)

    def test_agreed_to_active_allowed(self):
        self.transaction.state = TransactionState.AGREED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.activate(self.lender)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.ACTIVE)

    def test_agreed_to_disputed_allowed(self):
        self.transaction.state = TransactionState.AGREED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.dispute(self.borrower, 'Seller unresponsive')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.DISPUTED)

    def test_active_to_item_out_allowed(self):
        self.transaction.state = TransactionState.ACTIVE
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.handoff(self.lender)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.ITEM_OUT)

    def test_active_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ACTIVE
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.dispute(self.borrower, 'Item not as described')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.DISPUTED)

    def test_item_out_to_item_returned_allowed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.return_item(self.borrower)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.ITEM_RETURNED)

    def test_item_out_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.dispute(self.lender, 'Item damaged')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.DISPUTED)

    def test_item_returned_to_closed_allowed(self):
        self.transaction.state = TransactionState.ITEM_RETURNED
        self.transaction.save()
        TransactionStateMachine.transition(self.transaction, TransactionState.CLOSED, self.lender)
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.CLOSED)

    def test_item_returned_to_disputed_allowed(self):
        self.transaction.state = TransactionState.ITEM_RETURNED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.dispute(self.borrower, 'Deposit not released')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.DISPUTED)

    def test_disputed_to_closed_allowed(self):
        self.transaction.state = TransactionState.DISPUTED
        self.transaction.save()
        machine = TransactionStateMachine(self.transaction)
        machine.resolve_dispute(self.lender, 'split')
        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.state, TransactionState.CLOSED)

    def test_closed_no_transitions_allowed(self):
        self.transaction.state = TransactionState.CLOSED
        self.transaction.save()
        for state in TransactionState:
            if state != TransactionState.CLOSED:
                with self.assertRaises(InvalidTransitionError):
                    TransactionStateMachine.transition(self.transaction, state, self.lender)

    def test_invalid_transition_pending_to_item_out(self):
        with self.assertRaises(InvalidTransitionError):
            TransactionStateMachine.transition(self.transaction, TransactionState.ITEM_OUT, self.lender)

    def test_invalid_transition_agreed_to_item_out(self):
        self.transaction.state = TransactionState.AGREED
        self.transaction.save()
        with self.assertRaises(InvalidTransitionError):
            TransactionStateMachine.transition(self.transaction, TransactionState.ITEM_OUT, self.lender)

    def test_invalid_transition_active_to_closed(self):
        self.transaction.state = TransactionState.ACTIVE
        self.transaction.save()
        with self.assertRaises(InvalidTransitionError):
            TransactionStateMachine.transition(self.transaction, TransactionState.CLOSED, self.lender)

    def test_invalid_transition_item_out_to_closed(self):
        self.transaction.state = TransactionState.ITEM_OUT
        self.transaction.save()
        with self.assertRaises(InvalidTransitionError):
            TransactionStateMachine.transition(self.transaction, TransactionState.CLOSED, self.lender)

    def test_invalid_transition_disputed_to_item_out(self):
        self.transaction.state = TransactionState.DISPUTED
        self.transaction.save()
        with self.assertRaises(InvalidTransitionError):
            TransactionStateMachine.transition(self.transaction, TransactionState.ITEM_OUT, self.lender)

    def test_transition_creates_event(self):
        machine = TransactionStateMachine(self.transaction)
        machine.accept(self.lender)
        events = self.transaction.events.all()
        self.assertEqual(events.count(), 1)
        event = events.first()
        self.assertEqual(event.event_type, 'STATE_CHANGE')
        self.assertEqual(event.detail['from_state'], 'PENDING')
        self.assertEqual(event.detail['to_state'], 'AGREED')

    def test_can_transition_method(self):
        self.assertTrue(TransactionStateMachine.can_transition(
            TransactionState.PENDING, TransactionState.AGREED))
        self.assertTrue(TransactionStateMachine.can_transition(
            TransactionState.PENDING, TransactionState.DISPUTED))
        self.assertFalse(TransactionStateMachine.can_transition(
            TransactionState.PENDING, TransactionState.ITEM_OUT))
        self.assertFalse(TransactionStateMachine.can_transition(
            TransactionState.PENDING, TransactionState.CLOSED))

    def test_all_valid_transitions_defined(self):
        for from_state, to_states in TransactionStateMachine.ALLOWED_TRANSITIONS.items():
            self.assertIn(from_state, TransactionState)
            for to_state in to_states:
                self.assertIn(to_state, TransactionState)

    def test_no_transitions_from_closed(self):
        self.assertEqual(TransactionStateMachine.ALLOWED_TRANSITIONS[TransactionState.CLOSED], [])

    def test_disputed_can_only_go_to_closed(self):
        self.assertEqual(TransactionStateMachine.ALLOWED_TRANSITIONS[TransactionState.DISPUTED], [TransactionState.CLOSED])
