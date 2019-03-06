define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var alerts = {
		// Defines API requests not included in the SDK
		requests: {},

		// Define the events available for other apps
		subscribe: {
			'core.alerts.refresh': 'alertsRender'
		},

		appFlags: {
			alerts: {
				metadataFormat: {
					common: {
						available: {
							i18nKey: 'current_balance',
							valueType: 'price'
						}
					}
					/*
					// Format data can also be defined per category
					categories: {
						low_balance: {
							available: {
								i18nKey: 'current_balance',
								valueType: 'price'
							}
						}
					}
					*/
				}
			}
		},

		/**
		 * Trigger the alerts pulling process from API.
		 */
		alertsRender: function() {
			var self = this,
				initTemplate = function initTemplate(alerts) {
					var alertCount = alerts.length,
						formattedAlerts = self.alertsFormatData({ data: alerts }),
						dataTemplate = {
							alertCount: alertCount === 0 ? null : alertCount > 9 ? '9+' : alertCount.toString(),
							alertGroups: formattedAlerts
						},
						$template = $(self.getTemplate({
							name: 'nav',
							data: dataTemplate,
							submodule: 'alerts'
						}));

					monster.ui.tooltips($template);

					// TODO: Bind events. For UI-3319, clicking the topbar icon should clear the badge that shows the notification count.
					self.alertsBindEvents({ template: $template });

					return $template;
				};

			monster.waterfall([
				function(callback) {
					self.alertsRequestListAlerts({
						success: function(data) {
							callback(null, data);
						},
						error: function(parsedError) {
							callback(parsedError);
						}
					});
				}
			], function(err, alerts) {
				var $navLinks = $('#main_topbar_nav'),
					$topbarAlert = $navLinks.find('#main_topbar_alert'),
					templateAlerts = err ? [] : alerts,
					$template = initTemplate(templateAlerts);

				if ($topbarAlert.length === 0) {
					$template.insertBefore($navLinks.find('#main_topbar_signout'));
				} else {
					$topbarAlert.replaceWith($template);
				}
			});
		},

		/**
		 * Bind template content events
		 * @param  {Object} args
		 * @param  {jQuery} args.template  Template to bind
		 */
		alertsBindEvents: function(args) {
			var self = this,
				$template = args.template;

			$template.find('#main_topbar_alert_toggle_link').on('click', function(e) {
				e.preventDefault();

				var $this = $(this);

				$this.parent().toggleClass('open');
				$this.find('.badge').fadeOut({
					duration: 250,
					complete: function() {
						$(this).remove();
					}
				});
			});
		},

		/**
		 * Formats the alert data received from the API, into UI categories
		 * @param    {Object}   args
		 * @param    {Object[]} args.data  Array of alerts
		 * @returns  {Object}              Grouped alerts by UI categories
		 */
		alertsFormatData: function(args) {
			var self = this,
				sortOrder = {
					manual: '1',
					system: '2',
					apps: '3'
				},
				metadataFormat = self.appFlags.alerts.metadataFormat;

			return _.chain(args.data)
				.map(function(alert) {
					var alertData = _.get(alert, 'value', alert),
						category = alertData.category,
						metadata = _.reduce(alertData.metadata,
							function(metadataArray, value, key) {
								var formatData = _.get(
									metadataFormat.categories,
									category + '.' + key,
									_.get(metadataFormat.common, key)
								);

								if (formatData) {
									var metadataItem = {
										key: formatData.i18nKey,
										value: value
									};

									switch (formatData.valueType) {
										case 'price':
											metadataItem.value = monster.util.formatPrice({
												price: metadataItem.value
											});
											break;
										default: break;
									}

									metadataArray.push(metadataItem);
								}

								return metadataArray;
							}, []);

					return {
						title: alertData.title,
						metadata: metadata,
						message: alertData.message,
						category: category,
						clearable: alertData.clearable
					};
				})
				.groupBy(function(alert) {
					var category = alert.category,
						alertType,
						dashIndex;

					if (alert.clearable) {
						alertType = 'manual';
						alert.iconPath = monster.util.getAppIconPath({ name: 'websockets' });
					} else if (_.includes([ 'low_balance', 'no_payment_token', 'expired_payment_token' ], category)) {
						alertType = 'system';
					} else {
						dashIndex = category.indexOf('_');
						alertType = category.substring(0, dashIndex > 0 ? dashIndex : category.length);
						alert.iconPath = monster.util.getAppIconPath({ name: alertType });
					}

					return alertType;
				}).map(function(alerts, type) {
					return {
						type: type,
						alerts: alerts
					};
				}).sortBy(function(alertGroup) {
					return _.get(sortOrder, alertGroup.type) + alertGroup.type;
				}).value();
		},

		/**
		 * Request alerts list from API
		 * @param  {Object}   args
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		alertsRequestListAlerts: function(args) {
			var self = this;

			self.callApi({
				resource: 'alert.list',
				data: {
					accountId: monster.apps.auth.currentAccount.id
				},
				success: function(data, status) {
					_.has(args, 'success') && args.success(data.data, status);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		}
	};

	return alerts;
});
