export function createAdminState() {
  return {
    isLoading: false,
    overview: null,
    users: [],
    requests: [],
    projects: [],
    userSearchQuery: "",
    userRoleFilter: "all",
    requestFilter: "pending",
    requestSearchQuery: "",
    hasLoaded: false,
    activeTab: "users",
  };
}
