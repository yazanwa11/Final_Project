from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, APITestCase

from core.models import CareLog, CommunityPost, CommunityPostLike, Notification, Plant, Profile
from core.assistant_orchestrator import _detect_intent
from core.permissions import IsAdmin, IsExpert
from core.serializers import PlantSerializer, RoleAwareTokenObtainPairSerializer, UserSerializer


class UnitUserAndPermissionTests(TestCase):
	def test_user_serializer_creates_expert_profile_with_pending_status(self):
		serializer = UserSerializer(
			data={
				"username": "expert_candidate",
				"email": "expert@example.com",
				"password": "StrongPass123!",
				"role": "expert",
			}
		)
		self.assertTrue(serializer.is_valid(), serializer.errors)

		user = serializer.save()
		user.refresh_from_db()

		self.assertEqual(user.profile.role, "expert")
		self.assertEqual(user.profile.expert_approval_status, "pending")

	def test_role_aware_token_serializer_rejects_role_mismatch(self):
		user = User.objects.create_user(username="role_user", password="StrongPass123!")
		profile, _ = Profile.objects.get_or_create(user=user)
		profile.role = "user"
		profile.expert_approval_status = "approved"
		profile.save(update_fields=["role", "expert_approval_status"])

		serializer = RoleAwareTokenObtainPairSerializer(
			data={
				"username": "role_user",
				"password": "StrongPass123!",
				"role": "expert",
			}
		)

		with self.assertRaises(ValidationError):
			serializer.is_valid(raise_exception=True)

	def test_is_admin_permission_allows_staff_user(self):
		user = User.objects.create_user(username="staff_user", password="StrongPass123!", is_staff=True)

		class DummyRequest:
			pass

		request = DummyRequest()
		request.user = user

		permission = IsAdmin()
		self.assertTrue(permission.has_permission(request, view=None))

	def test_is_expert_permission_denies_regular_user(self):
		user = User.objects.create_user(username="regular_user", password="StrongPass123!")
		profile, _ = Profile.objects.get_or_create(user=user)
		profile.role = "user"
		profile.save(update_fields=["role"])

		class DummyRequest:
			pass

		request = DummyRequest()
		request.user = user

		permission = IsExpert()
		self.assertFalse(permission.has_permission(request, view=None))

class UnitPlantSerializerTests(TestCase):
	def test_plant_serializer_uses_image_url_when_file_is_missing(self):
		user = User.objects.create_user(username="plant_user", password="StrongPass123!")
		plant = Plant(
			user=user,
			name="Basil",
			category="Herb",
			image_url="https://example.com/basil.png",
		)

		request = APIRequestFactory().get("/api/plants/")
		serializer = PlantSerializer(instance=plant, context={"request": Request(request)})

		self.assertEqual(serializer.data["image"], "https://example.com/basil.png")


class UnitAssistantIntentTests(TestCase):
	def test_detect_intent_returns_pest_for_grasshopper_message(self):
		intent = _detect_intent("I have grasshoppers eating my basil leaves")
		self.assertEqual(intent, "pest")

	def test_detect_intent_returns_pest_for_hebrew_pest_message(self):
		intent = _detect_intent("יש לי חגבים על הצמח, מה לעשות?")
		self.assertEqual(intent, "pest")


class UnitCareLogConfigTests(TestCase):
	def test_carelog_action_choices_include_insecticide_and_fertilized(self):
		action_values = {value for value, _ in CareLog.ACTION_CHOICES}
		self.assertIn("Fertilized", action_values)
		self.assertIn("Insecticide", action_values)


class IntegrationAuthApiTests(APITestCase):
	def test_register_and_login_then_get_me(self):
		register_payload = {
			"username": "api_user",
			"email": "api_user@example.com",
			"password": "StrongPass123!",
			"role": "user",
		}
		register_response = self.client.post("/api/users/register/", register_payload, format="json")
		self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

		login_payload = {
			"username": "api_user",
			"password": "StrongPass123!",
			"role": "user",
		}
		login_response = self.client.post("/api/users/login/", login_payload, format="json")
		self.assertEqual(login_response.status_code, status.HTTP_200_OK)
		self.assertIn("access", login_response.data)

		access_token = login_response.data["access"]
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
		me_response = self.client.get("/api/users/me/")

		self.assertEqual(me_response.status_code, status.HTTP_200_OK)
		self.assertEqual(me_response.data["username"], "api_user")
		self.assertEqual(me_response.data["role"], "user")

	def test_pending_expert_cannot_login_as_expert(self):
		register_payload = {
			"username": "pending_expert",
			"email": "pending_expert@example.com",
			"password": "StrongPass123!",
			"role": "expert",
		}
		register_response = self.client.post("/api/users/register/", register_payload, format="json")
		self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

		login_payload = {
			"username": "pending_expert",
			"password": "StrongPass123!",
			"role": "expert",
		}
		login_response = self.client.post("/api/users/login/", login_payload, format="json")

		self.assertEqual(login_response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("detail", str(login_response.data).lower())


class IntegrationPlantsAndCommunityApiTests(APITestCase):
	def setUp(self):
		self.owner = User.objects.create_user(username="owner", password="StrongPass123!")
		self.other_user = User.objects.create_user(username="other", password="StrongPass123!")

	def authenticate(self, user):
		login_response = self.client.post(
			"/api/users/login/",
			{
				"username": user.username,
				"password": "StrongPass123!",
				"role": user.profile.role,
			},
			format="json",
		)
		self.assertEqual(login_response.status_code, status.HTTP_200_OK)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

	def test_mark_all_notifications_read_marks_only_current_user(self):
		Notification.objects.create(
			user=self.owner,
			type="system",
			title="Owner notification",
			body="owner body",
			is_read=False,
		)
		Notification.objects.create(
			user=self.other_user,
			type="system",
			title="Other notification",
			body="other body",
			is_read=False,
		)

		self.authenticate(self.owner)
		response = self.client.post("/api/notifications/read-all/", {}, format="json")
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		owner_unread = Notification.objects.filter(user=self.owner, is_read=False).count()
		other_unread = Notification.objects.filter(user=self.other_user, is_read=False).count()
		self.assertEqual(owner_unread, 0)
		self.assertEqual(other_unread, 1)

	def test_admin_users_endpoint_forbidden_for_regular_user(self):
		self.authenticate(self.owner)
		response = self.client.get("/api/admin/users/")
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_admin_users_endpoint_requires_authentication(self):
		response = self.client.get("/api/admin/users/")
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_list_notifications_returns_only_current_user_items(self):
		Notification.objects.create(
			user=self.owner,
			type="system",
			title="Owner 1",
			body="owner body",
		)
		Notification.objects.create(
			user=self.other_user,
			type="system",
			title="Other 1",
			body="other body",
		)

		self.authenticate(self.owner)
		response = self.client.get("/api/notifications/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["title"], "Owner 1")

	def test_mark_notification_read_404_for_other_users_notification(self):
		notification = Notification.objects.create(
			user=self.owner,
			type="system",
			title="Owner only",
			body="owner body",
			is_read=False,
		)

		self.authenticate(self.other_user)
		response = self.client.post(f"/api/notifications/{notification.id}/read/", {}, format="json")
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

		notification.refresh_from_db()
		self.assertFalse(notification.is_read)

	def test_community_post_edit_forbidden_for_non_owner(self):
		post = CommunityPost.objects.create(author=self.owner, text="Original text")

		self.authenticate(self.other_user)
		response = self.client.put(
			f"/api/feed/posts/{post.id}/update/",
			{"text": "Edited by someone else"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_community_post_update_rejects_empty_text(self):
		post = CommunityPost.objects.create(author=self.owner, text="Original text")

		self.authenticate(self.owner)
		response = self.client.put(
			f"/api/feed/posts/{post.id}/update/",
			{"text": "   "},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_community_post_delete_forbidden_for_non_owner(self):
		post = CommunityPost.objects.create(author=self.owner, text="Delete me")

		self.authenticate(self.other_user)
		response = self.client.delete(f"/api/feed/posts/{post.id}/delete/")
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertTrue(CommunityPost.objects.filter(id=post.id).exists())

	def test_toggle_community_like_creates_and_removes_like(self):
		post = CommunityPost.objects.create(author=self.owner, text="Like target")
		self.authenticate(self.other_user)

		first = self.client.post(f"/api/feed/posts/{post.id}/toggle-like/", {}, format="json")
		self.assertEqual(first.status_code, status.HTTP_200_OK)
		self.assertTrue(first.data["liked"])
		self.assertEqual(first.data["likes_count"], 1)
		self.assertTrue(CommunityPostLike.objects.filter(post=post, user=self.other_user).exists())

		second = self.client.post(f"/api/feed/posts/{post.id}/toggle-like/", {}, format="json")
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertFalse(second.data["liked"])
		self.assertEqual(second.data["likes_count"], 0)
		self.assertFalse(CommunityPostLike.objects.filter(post=post, user=self.other_user).exists())

	def test_toggle_community_like_returns_404_for_missing_post(self):
		self.authenticate(self.other_user)
		response = self.client.post("/api/feed/posts/999999/toggle-like/", {}, format="json")
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

