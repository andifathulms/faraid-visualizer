from django.contrib import admin

from .models import Source, ValidationCase


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("source_id", "type", "pointer", "reference")
    list_filter = ("type",)
    search_fields = ("source_id", "reference", "pointer", "note")


@admin.register(ValidationCase)
class ValidationCaseAdmin(admin.ModelAdmin):
    list_display = ("name", "ruleset", "aul_base", "radd")
    list_filter = ("ruleset", "radd")
    search_fields = ("name", "note")
