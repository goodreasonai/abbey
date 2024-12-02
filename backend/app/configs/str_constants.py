"""

This file contains string constants, which include special asset metadata keys and asset_resource names.

Changing these values might necessitate changes to schema.sql.

"""

# 
#
#  Asset metadata keys
#
#

# Retrieval sources are automatically made as sources to a retriever at certain endpoints (like /assets/chat) using the Template.get_asset_resources() function
# They contain ids to different assets, like Documents
RETRIEVAL_SOURCE = 'retrieval_source'

ASSET_STATE = 'state'  # matched in frontend, used for assets that carry a user editable aggregated state in asset_metadata (i.e., notebook blocks+key points...)

"""

A permissions request associates an asset with increased permissioning for the people who have access to the asset.
They can be used to allow an asset to display to all users information about the other users.
Templates deal with how permissions requests actually function.

Their value can be 0, 1, or 2 for 'not seen', 'accepted', and 'rejected'.
The user_id column for the entry is set to the appropriate requested user.
They typically also have the needs_attention flag set, which will make the permissions requests show up on the home page of the requested user.

"""
PERMISSIONS_REQUEST = 'permissions_request'

# Signifies saved chat context that is tied to a user/asset pair.
CHAT_CONTEXT = 'chat_context'

# Specifies user specific data tied to an asset (like progress in a curriculum)
USER_DATA = 'user_state'  # matched in frontend

# !!!NEEDS TO BE USED AS TEMPLATE STRING!!!
# Gives metadata on user's place in a piece of media
MEDIA_USER_INFO = "user_media_info_{name}"

# These keys are only returned if the user id in the entry matches the requesting user's id. 
PROTECTED_METADATA_KEYS = [CHAT_CONTEXT, MEDIA_USER_INFO]

# When a user deliberately edits an asset after creation, an asset metadata entry with this key is made (value set to 1)
HAS_EDITED_ASSET_TITLE = "has_edited_asset"  # doesn't say "title" for legacy reasons
HAS_EDITED_ASSET_DESC = "has_edited_desc"

# Book order specifies a certain order in which folder assets should be displayed. Not required for folders.
BOOK_ORDER = 'book_order'

#
#
# Job-related
#
#

# The job that makes a retriever, particularly on upload of an asset.
MAKE_RETRIEVER = 'make_retriever'

# An applier response is a database entry containing information (probably in JSON) about an application of a particular asset.
# You can use applier responses instead of jobs if you want the "temporary" data to stay in the database.
APPLIER_RESPONSE = 'applier_response'

SUMMARY_PAIRWISE_JOB = 'summary_reduce'
SUMMARY_APPLY_JOB = 'summary_apply'

#
#
# User metadata keys
#
#

# Determine the chosen models of the user
USER_CHAT_MODEL = 'chat-model'
USER_TTS_MODEL = 'tts-model'
USER_SEARCH_ENGINE = 'seach-engine'

USER_TEXT_EDITOR_PROMPTS = 'user_te_prompts'  # saved text editor prompts
USER_PRODUCT_CODE = 'product-code'  # product codes that the user has previously entered
USER_PIN = "pin"  # pinned asset
USER_UPLOAD_COUNTER = "upload-counter"  # every upload should increase this counter

#
#
# Stripe related
#
#

# User checkout session - the user initiated a subscription, and is being brought to the checkout window
# Carries: {'session_id': stripe checkout session id, 'resolved': bool}
USER_CHECKOUT_SESSION = 'user_checkout_session'

# Subscription - the user has an active subscription to the product specified in the value
# The value is a JSON string based on the Product class in pay.py
USER_SUBSCRIPTION = 'user_subscription'

# 
#
#  Asset resource names
#
#

# The main file is what gets returned when you ask for an asset's file, like at /assets/file
MAIN_FILE = 'main'

SUMMARY_FILE = 'summary'
KEY_POINTS_FILE = 'key-points'

# Preview file for groups
PREVIEW_FILE = "preview"

#
#
#  Activity Log Types
#
#

VIEW_ACTIVITY = "view"
UPLOAD_EDIT_ACTIVITY = "upload/edit"
DELETE_ACTIVITY = "delete"
CHAT_ACTIVITY = "chat"
APPLY_ACTIVITY = "applier_apply"
REDUCE_ACTIVITY = "applier_reduce"
DELETE_JOB_ACTIVITY = "delete_job"
REVISE_ACTIVITY = "revise"
SPEAK_ACTIVITY = "speak"
CURR_START_ACTIVITY = "curr_start"
CURR_COMPLETE_ACTIVITY = "curr_complete"
QUIZ_GRADE_ACTIVITY = "quiz_grade"
SUMMARY_ACTIVITY = "make_summary"
QUICK_SUMMARY_ACTIVITY = "make_quick_summary"
KEY_POINTS_ACTIVITY = "make_key_points"
USER_ALERT_ACTIVITY = "alert-resp"  # When a user is given an alert (like a recommendation) and responds to it


"""

Others

"""

# This is the "endpoint" for scheduled emails, to put in the notifications table
SCHEDULED_ENDPOINT = "_scheduled"

# Question types for inf quiz / quiz
MULTIPLE_CHOICE = "Multiple Choice"
SHORT_ANSWER = "Short Answer"

# For streaming chats to frontend
DIVIDER_TEXT = "<~|END|~>"  # needs to match in frontend
CHAT_ERROR_TEXT = "<~|ERROR|~>"  # needs to match in frontend
